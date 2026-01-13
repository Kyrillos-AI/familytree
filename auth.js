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
      creatorId: user.uid,
      ownerId: user.uid,
      adminId: user.uid,
      admins: [user.uid],
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

window.isSignupMode = false;

window.toggleAuthMode = (e) => {
  if (e) e.preventDefault();

  // ✅ تصحيح 2: تحديث المتغير العام
  window.isSignupMode = !window.isSignupMode;

  const nameGroup = document.getElementById("name-group");
  const title = document.getElementById("form-title");
  const btn = document.getElementById("btn-action");
  const switchTxt = document.getElementById("switch-text");
  const switchAct = document.getElementById("switch-action");

  if (window.isSignupMode) {
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

/* ========================================= */
/* 🚀 دالة الدخول والتسجيل (الذكية) */
/* ========================================= */
window.handleAuthAction = async () => {
  const email = document.getElementById("auth-email").value.trim();
  const pass = document.getElementById("auth-password").value;
  const name = document.getElementById("auth-name").value.trim();
  const btn = document.getElementById("btn-action");

  // فحوصات سريعة
  if (!email)
    return window.showNotification(
      "⚠️ اكتب البريد الإلكتروني أولاً",
      "warning"
    );
  if (!pass) return window.showNotification("⚠️ اكتب كلمة المرور", "warning");

  // ✅ تصحيح 3: التحقق من الاسم فقط إذا كنا في وضع الإنشاء
  if (window.isSignupMode && !name)
    return window.showNotification("⚠️ اكتب اسمك", "warning");

  // تغيير الزر لوضع التحميل
  const originalText = btn.innerText;
  btn.innerText = "جاري التحقق...";
  btn.disabled = true;

  try {
    let userCredential;

    // ✅ تصحيح 4: الشرط الآن سيعمل بشكل صحيح
    if (window.isSignupMode) {
      // ----------------------------
      // 🔥 حالة إنشاء حساب جديد
      // ----------------------------
      console.log("جاري إنشاء حساب جديد...");

      // 1. إنشاء الحساب في Authentication (هذا يقوم بتسجيل الدخول تلقائياً أيضاً)
      userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const user = userCredential.user;

      // 2. تحديث الاسم في ملف التعريف
      await updateProfile(user, { displayName: name });

      // 3. حفظ البيانات في Firestore
      await setDoc(doc(db, "users", user.uid), {
        name: name,
        email: email,
        photoURL: "logo.png", // صورة افتراضية
        createdAt: new Date().toISOString(),
        role: "user",
        // يمكنك إضافة linkedTreeId: null هنا إذا أردت
      });

      window.showNotification("تم إنشاء الحساب بنجاح! 🎉", "success");

      // ملاحظة: لا داعي لكتابة كود تسجيل دخول هنا، لأن createUserWithEmailAndPassword
      // تقوم بتسجيل الدخول تلقائياً، و onAuthStateChanged في بداية الملف ستنقل المستخدم للصفحة التالية.
    } else {
      // ----------------------------
      // 🔑 حالة تسجيل الدخول
      // ----------------------------
      console.log("جاري تسجيل الدخول...");
      await signInWithEmailAndPassword(auth, email, pass);
      window.showNotification("تم تسجيل الدخول بنجاح 👋", "success");
    }
  } catch (error) {
    console.error("Auth Error:", error);
    const friendlyMsg = getFriendlyErrorMessage(error);
    window.showNotification(friendlyMsg, "error");

    // نرجع الزرار زي ما كان عند الخطأ فقط
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

/* ========================================= */
/* 🧠 مترجم الأخطاء التفصيلي */
/* ========================================= */
function getFriendlyErrorMessage(error) {
  const code = error.code;
  console.log("Error Code:", code); // عشان نشوف الكود في الكونسول

  switch (code) {
    // 🛑 حالة: الباسورد غلط
    case "auth/wrong-password":
      return "🔑 كلمة المرور غير صحيحة! تأكد من اللغة أو مفتاح Caps Lock.";

    // 🚫 حالة: الإيميل مش موجود أصلاً
    case "auth/user-not-found":
      return "📧 هذا البريد غير مسجل عندنا. تأكد من كتابته أو أنشئ حساباً جديداً.";

    // ⚠️ حالة: الإيميل موجود ومستخدم قبل كدا
    case "auth/email-already-in-use":
      return "✋ هذا البريد مسجل بالفعل! حاول تسجيل الدخول بدلاً من إنشاء حساب.";

    // 📝 حالة: صيغة الإيميل غلط (ناسي @ أو .com)
    case "auth/invalid-email":
      return "📝 صيغة البريد الإلكتروني غير صحيحة.";

    // 🛡️ حالة: باسورد ضعيف
    case "auth/weak-password":
      return "weak 👮 كلمة المرور ضعيفة جداً (يجب أن تكون 6 أحرف على الأقل).";

    // ❌ حالة: الحماية (لو مقفلتش الحماية في الكونسول هيطلعلك دي)
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return "❌ بيانات الدخول غير صحيحة (تأكد من البريد وكلمة المرور).";

    // 📡 حالة: مفيش نت
    case "auth/network-request-failed":
      return "📡 فشل الاتصال.. تأكد من الإنترنت وحاول مجدداً.";

    case "auth/too-many-requests":
      return "⏳ محاولات كثيرة خاطئة.. تم حظر الحساب مؤقتاً.";

    default:
      return "حدث خطأ غير متوقع: " + code;
  }
}
// 2. نظام الإشعارات المخصص
window.showNotification = (msg, type = "info") => {
  const container = document.getElementById("notification-container");
  if (!container) return alert(msg); // Fallback لو الكونتينر مش موجود

  const toast = document.createElement("div");
  toast.className = `toast-msg ${type}`;

  // اختيار الأيقونة
  let icon = "🔔";
  if (type === "success") icon = "✅";
  if (type === "error") icon = "❌";
  if (type === "warning") icon = "⚠️";

  toast.innerHTML = `<span>${icon}</span> <span>${msg}</span>`;

  container.appendChild(toast);

  // الحذف التلقائي بعد 4 ثواني
  setTimeout(() => {
    toast.style.animation = "slideDown 0.3s ease-in reverse forwards";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};

/* ========================================= */
/* 🔐 دوال المصادقة الأساسية */
/* ========================================= */

// 1. إنشاء حساب جديد
window.createNewAccount = async () => {
  const name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const gender = document.querySelector('input[name="gender"]:checked')?.value;

  if (!name || !email || !password || !gender) {
    return window.showNotification(
      "يرجى ملء جميع البيانات المطلوبة",
      "warning"
    );
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    // تحديث الاسم في البروفايل
    await updateProfile(user, { displayName: name });

    // حفظ البيانات في Firestore
    try {
      await setDoc(doc(db, "users", user.uid), {
        name: name,
        email: email,
        gender: gender,
        photoURL: "logo.png",
        createdAt: new Date().toISOString(),
        linkedMemberId: null,
        role: "user",
      });

      window.showNotification(
        "تم إنشاء الحساب بنجاح! جاري الدخول...",
        "success"
      );
      // التوجيه بيحصل تلقائي من onAuthStateChanged
    } catch (fsError) {
      console.error("Firestore Error:", fsError);
      // لو فشل حفظ البيانات، نمسح الحساب لتجنب المشاكل
      await user.delete();
      throw new Error("فشل في حفظ قاعدة البيانات، حاول مجدداً.");
    }
  } catch (error) {
    window.showNotification(getFriendlyErrorMessage(error), "error");
  }
};

// 2. تسجيل الدخول
window.loginUser = async () => {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  if (!email || !password) {
    return window.showNotification("اكتب البريد وكلمة المرور!", "warning");
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.showNotification("تم تسجيل الدخول بنجاح 👋", "success");
  } catch (error) {
    window.showNotification(getFriendlyErrorMessage(error), "error");
  }
};

// 3. الدخول بجوجل
window.loginWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // التأكد من وجود ملف المستخدم
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (!userDoc.exists()) {
      await setDoc(doc(db, "users", user.uid), {
        name: user.displayName,
        email: user.email,
        gender: "male", // افتراضي
        photoURL: user.photoURL,
        createdAt: new Date().toISOString(),
        role: "user",
      });
      window.showNotification("مرحباً بك! تم إنشاء حسابك.", "success");
    } else {
      window.showNotification("مرحباً بعودتك! 👋", "success");
    }
  } catch (error) {
    window.showNotification(getFriendlyErrorMessage(error), "error");
  }
};

window.resetPassword = async (e) => {
  // 1. منع المتصفح من عمل ريفريش
  if (e) e.preventDefault();

  // 2. جلب الإيميل من الخانة المكتوبة
  const emailInput = document.getElementById("auth-email");
  const email = emailInput ? emailInput.value.trim() : "";

  // 3. التحقق إن الإيميل مكتوب
  if (!email) {
    return window.showNotification(
      "⚠️ اكتب بريدك الإلكتروني في الخانة أعلاه أولاً",
      "warning"
    );
  }

  // تأثير بصري عشان المستخدم يعرف إننا بنحمل
  const linkBox = document.getElementById("forgot-link-box");
  const originalLink = linkBox.innerHTML; // نحفظ الشكل القديم
  linkBox.innerHTML =
    '<span style="color:#bbb; font-size:0.9rem">جاري الإرسال... ⏳</span>';

  try {
    // 4. إرسال الطلب لفايربيز
    await sendPasswordResetEmail(auth, email);

    // نجاح
    window.showNotification(
      `✅ تم الإرسال! راجع بريدك (والمهملات Junk)`,
      "success"
    );
    linkBox.innerHTML =
      '<span style="color:#4ade80; font-size:0.9rem">تم الإرسال بنجاح ✅</span>';

    // نرجع الزرار زي ما كان بعد 5 ثواني
    setTimeout(() => {
      linkBox.innerHTML = originalLink;
    }, 5000);
  } catch (error) {
    console.error("Reset Error:", error);

    // نرجع الرابط عشان يحاول تاني
    linkBox.innerHTML = originalLink;

    // معالجة الأخطاء الشائعة
    if (error.code === "auth/user-not-found") {
      window.showNotification("❌ هذا البريد غير مسجل لدينا", "error");
    } else if (error.code === "auth/invalid-email") {
      window.showNotification("❌ صيغة البريد غير صحيحة", "error");
    } else {
      window.showNotification("حدث خطأ: " + error.message, "error");
    }
  }
};

/* ========================================= */
/* 🔄 مراقب الحالة والتنقلات */
/* ========================================= */
onAuthStateChanged(auth, (user) => {
  if (user) {
    // المستخدم مسجل -> توجيه للداخل
    const authView = document.getElementById("auth-view");
    const mainView = document.getElementById("choice-main-view");

    if (authView && mainView) {
      authView.classList.add("hidden");
      mainView.classList.remove("hidden");
    }
  } else {
    // المستخدم خرج -> توجيه للدخول
    const authView = document.getElementById("auth-view");
    const mainView = document.getElementById("choice-main-view");

    if (authView && mainView) {
      authView.classList.remove("hidden");
      mainView.classList.add("hidden");
      // إخفاء باقي الشاشات
      document.getElementById("create-tree-view")?.classList.add("hidden");
      document.getElementById("join-tree-view")?.classList.add("hidden");
    }
  }
});

// دوال التنقل (UI Helpers)
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
  signOut(auth).then(() => {
    window.showNotification("تم تسجيل الخروج", "info");
    setTimeout(() => location.reload(), 1000);
  });
};
