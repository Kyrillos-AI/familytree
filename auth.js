/* ========================================= */
/* 📂 auth.js - النسخة النهائية (Debug Mode) */
/* ========================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged, // 👈 استدعاء مهم جداً
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* 1. إعدادات الفايربيز */
const firebaseConfig = {
  apiKey: "AIzaSyDDuWxwcYI3l6UAj2UsMzSBVFYFACjck94",
  authDomain: "familytree-7c8be.firebaseapp.com",
  projectId: "familytree-7c8be",
  storageBucket: "familytree-7c8be.firebasestorage.app",
  messagingSenderId: "140789780230",
  appId: "1:140789780230:web:b815fccf7d4e5fc02a5887",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();

// ربط المتغيرات بالنافذة لتكون عامة
window.auth = auth;
window.db = db;

/* ========================================= */
/* 2. إدارة حالة المستخدم (الحل للمشاكل)     */
/* ========================================= */

// هذا الكود يعمل تلقائياً عند تحميل الصفحة ويتأكد من حالة الدخول
onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log("🟢 المستخدم متصل:", user.email);
    // المستخدم مسجل دخول -> نفحص هل لديه شجرة أم لا
    await checkUserTreeStatus(user.uid);
  } else {
    console.log("🔴 لا يوجد مستخدم مسجل دخول");
    // إظهار واجهة تسجيل الدخول الأساسية
    const landing = document.getElementById("landing-page");
    if (landing) landing.style.display = "flex";

    const loginPanel = document.querySelector(
      ".login-panel:not(#tree-select-panel)"
    );
    if (loginPanel) loginPanel.style.display = "flex";

    const treePanel = document.getElementById("tree-select-panel");
    if (treePanel) treePanel.classList.add("hidden");
  }
});

/* ========================================= */
/* 3. الوظائف الأساسية (UI Logic)            */
/* ========================================= */

// دالة الإشعارات
window.showNotification = (message, type = "info") => {
  let icon = "🔔",
    color = "#10b981",
    title = "تنبيه";
  if (type === "error") {
    icon = "⚠️";
    color = "#ff4757";
    title = "خطأ";
  }
  if (type === "search") {
    icon = "🔍";
    color = "#3b82f6";
    title = "بحث";
  }

  // إنشاء العنصر لو مش موجود
  let overlay = document.getElementById("google-alert-overlay");
  if (!overlay) {
    const html = `<div id="google-alert-overlay" class="alert-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:99999; justify-content:center; align-items:center;">
        <div class="custom-alert glass" style="background:#1e293b; padding:20px; border-radius:15px; text-align:center; min-width:300px; color:white; border:1px solid #ffffff22; max-width:90%;">
            <div style="font-size:2rem; margin-bottom:10px">${icon}</div>
            <h3 id="notif-title" style="color:${color}; margin:0 0 10px 0">${title}</h3>
            <p id="notif-msg" style="font-size:1rem; margin-bottom:20px; line-height:1.5">${message}</p>
            <button onclick="document.getElementById('google-alert-overlay').style.display='none'" style="width:100%; padding:12px; border-radius:8px; border:none; background:${color}; color:white; font-weight:bold; cursor:pointer; font-size:1rem">حسناً</button>
        </div>
    </div>`;
    document.body.insertAdjacentHTML("beforeend", html);
    overlay = document.getElementById("google-alert-overlay");
  }

  // تحديث البيانات وعرضه
  overlay.querySelector(".custom-alert > div").innerHTML = icon;
  overlay.querySelector("#notif-title").innerText = title;
  overlay.querySelector("#notif-title").style.color = color;
  overlay.querySelector("#notif-msg").innerText = message;
  overlay.querySelector("button").style.background = color;
  overlay.style.display = "flex";
};

// الدخول للتطبيق
window.enterApp = () => {
  console.log("🚀 الدخول للتطبيق...");
  const landing = document.getElementById("landing-page");
  if (landing) {
    landing.style.opacity = "0";
    setTimeout(() => {
      landing.style.display = "none";
      const appView = document.getElementById("app-view");
      if (appView) {
        appView.style.display = "block";
        requestAnimationFrame(() => {
          appView.style.opacity = "1";
          appView.style.transform = "scale(1)";
        });
      } else {
        // لو مفيش div اسمه app-view (احتياطي)
        window.location.href = "tree.html";
      }
    }, 500);
  }
};

/* ========================================= */
/* 4. منطق فحص المستخدم (Tree Logic)         */
/* ========================================= */

window.checkUserTreeStatus = async (uid) => {
  try {
    const userDoc = await getDoc(doc(db, "users", uid));

    // 1. لو بيانات المستخدم موجودة وسليمة
    if (userDoc.exists()) {
      const userData = userDoc.data();
      if (userData.treeId) {
        console.log("✅ المستخدم يملك شجرة ID:", userData.treeId);
        window.enterApp();
      } else {
        console.log("⚠️ المستخدم جديد، إظهار لوحة الاختيار");
        showTreeSelectionPanel();
      }
    }
    // 2. 👇 الحل السحري: لو البيانات ممسوحة من الداتا بيز، نخرجه فوراً
    else {
      console.warn(
        "⛔ حساب معلق (موجود في Auth ومحذوف من DB) - جاري الخروج..."
      );
      await signOut(auth);
      window.showNotification(
        "تم اكتشاف خطأ في الحساب، يرجى التسجيل مجدداً",
        "error"
      );
      setTimeout(() => location.reload(), 1000);
    }
  } catch (error) {
    console.error("خطأ في جلب بيانات المستخدم:", error);
    window.showNotification("حدث خطأ في الاتصال", "error");
  }
};

function showTreeSelectionPanel() {
  // إخفاء كارت تسجيل الدخول العادي
  const loginCards = document.querySelectorAll(
    ".login-panel:not(#tree-select-panel)"
  );
  loginCards.forEach((c) => (c.style.display = "none"));

  // إظهار كارت الاختيار
  const selectionPanel = document.getElementById("tree-select-panel");
  if (selectionPanel) {
    selectionPanel.classList.remove("hidden");
    selectionPanel.style.display = "flex"; // تأكيد الـ Flex
  }
}

/* ========================================= */
/* 🌳 إنشاء شجرة جديدة (دخول مباشر) */
/* ========================================= */
window.createNewTree = async () => {
  // 1. التحقق من المستخدم
  const user = auth.currentUser;
  if (!user) {
    return window.showNotification("يرجى تسجيل الدخول أولاً", "error");
  }

  // 2. جلب البيانات من HTML
  const nameInput = document.getElementById("new-tree-name");
  const passInput = document.getElementById("new-tree-password");
  const religionInput = document.querySelector(
    'input[name="religion"]:checked'
  );

  if (!nameInput || !passInput) {
    return window.showNotification("حدث خطأ في عناصر الصفحة", "error");
  }

  const name = nameInput.value;
  const password = passInput.value;
  const religion = religionInput ? religionInput.value : "muslim";

  // 3. التحقق من صحة المدخلات
  if (!name)
    return window.showNotification("الرجاء كتابة اسم العائلة", "error");
  if (!password)
    return window.showNotification("مطلوب كلمة سر للعائلة", "error");

  const btn = document.querySelector("#create-tree-view .action-btn");
  if (btn) {
    btn.innerText = "جاري التأسيس...";
    btn.disabled = true;
  }

  try {
    window.showNotification("جاري بناء شجرة العائلة...", "search");

    // 🅰️ الخطوة 1: إنشاء وثيقة الشجرة
    const treeRef = await addDoc(collection(db, "trees"), {
      name: name,
      password: password,
      religion: religion,
      adminId: user.uid,
      createdAt: new Date().toISOString(),
    });

    // 🅱️ الخطوة 2: إنشاء العضو المؤسس (ROOT)
    const firstMemberRef = await addDoc(
      collection(db, "trees", treeRef.id, "members"),
      {
        name: user.displayName || name,
        gender: "male", // افتراضي
        img: user.photoURL || "mainmale.png",
        isRoot: true,
        linkedUserId: user.uid,
        level: 0,
        createdAt: new Date().toISOString(),
      }
    );

    // 🆎 الخطوة 3: تحديث بيانات المستخدم (الربط)
    await updateDoc(doc(db, "users", user.uid), {
      linkedTreeId: treeRef.id, // ربط الشجرة
      linkedMemberId: firstMemberRef.id, // ربط العضوية
      role: "admin",
    });

    window.showNotification("تم الإنشاء! جاري الدخول...", "success");

    // 🚀🚀🚀 التعديل الجوهري هنا 🚀🚀🚀
    // بدلاً من الانتظار أو إعادة التحميل، نذهب مباشرة لصفحة الشجرة
    setTimeout(() => {
      window.location.href = "tree.html";
    }, 1000); // ثانية واحدة عشان يلحق يشوف رسالة النجاح
  } catch (error) {
    console.error("خطأ أثناء الإنشاء:", error);
    window.showNotification("حدث خطأ: " + error.message, "error");
    if (btn) {
      btn.innerText = "إنشاء الشجرة";
      btn.disabled = false;
    }
  }
};
// البحث عن شجرة
let searchTimeout;
window.searchForTrees = (term) => {
  clearTimeout(searchTimeout);
  const resultsArea = document.getElementById("search-results-area");
  if (!resultsArea) return;

  if (term.length < 1) {
    resultsArea.innerHTML =
      '<div class="placeholder-text">ابدأ الكتابة للبحث...</div>';
    return;
  }

  resultsArea.innerHTML =
    '<div class="placeholder-text">جاري البحث... ⏳</div>';

  searchTimeout = setTimeout(async () => {
    try {
      console.log("🔍 بحث عن:", term);

      // الاستعلام: الاسم يبدأ بـ term
      const q = query(
        collection(db, "trees"),
        where("name", ">=", term),
        where("name", "<=", term + "\uf8ff")
      );

      const querySnapshot = await getDocs(q);
      console.log("نتائج البحث:", querySnapshot.size);

      resultsArea.innerHTML = "";

      if (querySnapshot.empty) {
        resultsArea.innerHTML =
          '<div class="placeholder-text">لا توجد عائلة بهذا الاسم 😕</div>';
      } else {
        querySnapshot.forEach((docSnap) => {
          const tree = docSnap.data();
          const treeId = docSnap.id;

          let icon = tree.religion === "christian" ? "✝️" : "☪️";

          const item = document.createElement("div");
          item.className = "tree-result-item";
          item.innerHTML = `
                        <div style="text-align:right">
                            <strong style="color:white; display:block">${
                              tree.name
                            }</strong>
                            <span style="font-size:0.8rem; color:#aaa">${icon} ${
            tree.religion === "christian" ? "مسيحي" : "إسلامي"
          }</span>
                        </div>
                        <button onclick="joinTree('${treeId}', '${
            tree.name
          }')">انضمام</button>
                    `;
          resultsArea.appendChild(item);
        });
      }
    } catch (error) {
      console.error("خطأ في البحث:", error);
      resultsArea.innerHTML =
        '<div class="placeholder-text" style="color:#ff4757">تأكد من صلاحيات الفايربيز (Rules)</div>';
    }
  }, 500);
};

// الانضمام لشجرة (مودال الباسورد)
let targetTreeId = null;

window.joinTree = (treeId, treeName) => {
  targetTreeId = treeId;
  const modal = document.getElementById("password-challenge-modal");
  if (modal) {
    modal.style.display = "flex";
    modal.classList.remove("hidden");
    document.getElementById("join-tree-password").focus();
  }
};

window.verifyAndJoin = async () => {
  const passInput = document.getElementById("join-tree-password");
  const inputPass = passInput.value;

  if (!inputPass) return window.showNotification("أدخل كلمة السر", "error");

  try {
    const treeDoc = await getDoc(doc(db, "trees", targetTreeId));
    if (treeDoc.exists()) {
      const realPass = treeDoc.data().password;

      if (realPass === inputPass) {
        // الباسورد صح
        const user = auth.currentUser;
        await updateDoc(doc(db, "users", user.uid), {
          treeId: targetTreeId,
          role: "member",
        });

        window.showNotification("تم الانضمام بنجاح!", "success");
        document.getElementById("password-challenge-modal").style.display =
          "none";
        window.enterApp();
      } else {
        window.showNotification("كلمة السر خاطئة ❌", "error");
      }
    }
  } catch (err) {
    console.error(err);
    window.showNotification("حدث خطأ في الاتصال", "error");
  }
};

window.closePasswordModal = () => {
  document.getElementById("password-challenge-modal").style.display = "none";
};

/* ========================================= */
/* 6. إدارة تسجيل الدخول (Login/Signup)      */
/* ========================================= */

let isSignupMode = false;

window.toggleAuthMode = (e) => {
  if (e) e.preventDefault();
  isSignupMode = !isSignupMode;

  const nameGroup = document.getElementById("name-group");
  const title = document.getElementById("form-title");
  const btn = document.getElementById("btn-action");
  const switchTxt = document.getElementById("switch-text");
  const switchAct = document.getElementById("switch-action");

  if (isSignupMode) {
    nameGroup.classList.remove("hidden");
    title.innerText = "إنشاء حساب جديد";
    btn.innerText = "إنشاء الحساب";
    switchTxt.innerText = "لديك حساب؟";
    switchAct.innerText = "تسجيل الدخول";
  } else {
    nameGroup.classList.add("hidden");
    title.innerText = "تسجيل الدخول";
    btn.innerText = "تسجيل دخول";
    switchTxt.innerText = "جديد هنا؟";
    switchAct.innerText = "إنشاء حساب";
  }
};

window.handleAuthAction = async () => {
  const email = document.getElementById("auth-email").value;
  const pass = document.getElementById("auth-password").value;
  const name = document.getElementById("auth-name").value;
  const btn = document.getElementById("btn-action");

  if (!email || !pass)
    return window.showNotification("البيانات ناقصة", "error");
  if (isSignupMode && !name)
    return window.showNotification("الاسم مطلوب", "error");

  const originalText = btn.innerText;
  btn.innerText = "جاري...";
  btn.disabled = true;

  try {
    let userCredential;
    if (isSignupMode) {
      userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(userCredential.user, { displayName: name });
      await setDoc(doc(db, "users", userCredential.user.uid), {
        name: name,
        email: email,
        createdAt: new Date().toISOString(),
      });
      window.showNotification("تم إنشاء الحساب", "success");
    } else {
      await signInWithEmailAndPassword(auth, email, pass);
    }
    // لا نحتاج لاستدعاء checkUserTreeStatus يدوياً هنا
    // لأن onAuthStateChanged ستقوم بذلك تلقائياً
  } catch (error) {
    console.error(error);
    let msg = "خطأ في العملية";
    if (error.code === "auth/email-already-in-use") msg = "البريد مسجل مسبقاً";
    if (error.code === "auth/wrong-password") msg = "كلمة المرور خطأ";
    if (error.code === "auth/user-not-found") msg = "الحساب غير موجود";
    window.showNotification(msg, "error");
    btn.innerText = originalText;
    btn.disabled = false;
  }
};

window.loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (!userDoc.exists()) {
      await setDoc(doc(db, "users", user.uid), {
        name: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error(error);
    window.showNotification("فشل الدخول بجوجل", "error");
  }
};

window.loginWithFacebook = async () => {
  try {
    const result = await signInWithPopup(auth, facebookProvider);
    const user = result.user;
    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (!userDoc.exists()) {
      await setDoc(doc(db, "users", user.uid), {
        name: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error(error);
    window.showNotification("فشل الدخول بفيسبوك", "error");
  }
};

// التنقلات
window.showSearchTree = () => {
  document.getElementById("choice-main-view").classList.add("hidden");
  document.getElementById("join-tree-view").classList.remove("hidden");
};
window.showCreateTree = () => {
  document.getElementById("choice-main-view").classList.add("hidden");
  document.getElementById("create-tree-view").classList.remove("hidden");
};
window.backToChoiceMain = () => {
  document.getElementById("join-tree-view").classList.add("hidden");
  document.getElementById("create-tree-view").classList.add("hidden");
  document.getElementById("choice-main-view").classList.remove("hidden");
};
window.logoutFromSelection = () => {
  signOut(auth).then(() => location.reload());
};
window.resetPassword = async () => {
  const email = document.getElementById("auth-email").value;
  if (!email)
    return window.showNotification("اكتب البريد الإلكتروني أولاً", "error");
  try {
    await sendPasswordResetEmail(auth, email);
    window.showNotification("تم إرسال رابط الاستعادة 📧", "success");
  } catch (error) {
    window.showNotification("خطأ: " + error.code, "error");
  }
};
