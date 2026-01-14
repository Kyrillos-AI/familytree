/* ========================================= */
/* 📂 auth.js - النسخة النهائية الموحدة */
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
  onAuthStateChanged,
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

// ربط المتغيرات بالنافذة
window.auth = auth;
window.db = db;

// متغير عالمي لحالة التسجيل
let isSignupMode = false;

/* ========================================= */
/* 2. إدارة حالة المستخدم (Unified Listener) */
/* ========================================= */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log("🟢 المستخدم متصل:", user.email);
    // إخفاء واجهة تسجيل الدخول وإظهار التطبيق أو شاشة الاختيار
    const authView = document.getElementById("auth-view"); // إن وجد
    if (authView) authView.classList.add("hidden");

    // فحص الشجرة
    await checkUserTreeStatus(user.uid);
  } else {
    console.log("🔴 لا يوجد مستخدم مسجل دخول");

    // إظهار واجهة تسجيل الدخول
    const landing = document.getElementById("landing-page");
    if (landing) landing.style.display = "flex";

    const loginPanel = document.getElementById("login-panel-content");
    const introPanel = document.getElementById("intro-panel-content");

    // 🔥 ضبط العرض بناءً على حجم الشاشة الحالي فوراً
    if (window.innerWidth <= 768) {
      if (loginPanel) loginPanel.style.display = "none";
      if (introPanel) introPanel.style.display = "flex";
    } else {
      if (loginPanel) loginPanel.style.display = "flex";
      if (introPanel) introPanel.style.display = "block";
    }

    const treePanel = document.getElementById("tree-select-panel");
    if (treePanel) treePanel.classList.add("hidden");

    // إعادة تعيين الحقول
    isSignupMode = false;
    toggleAuthMode(null, true);
  }
});

/* ========================================= */
/* 3. منطق فحص المستخدم والشجرة */
/* ========================================= */
window.checkUserTreeStatus = async (uid) => {
  try {
    const userDoc = await getDoc(doc(db, "users", uid));

    if (userDoc.exists()) {
      const userData = userDoc.data();
      if (userData.treeId) {
        console.log("✅ المستخدم يملك شجرة ID:", userData.treeId);
        window.enterApp();
      } else {
        console.log("⚠️ المستخدم جديد، إظهار لوحة الاختيار");
        showTreeSelectionPanel();
      }
    } else {
      console.warn("⛔ حساب معلق - جاري الخروج...");
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

window.enterApp = () => {
  console.log("🚀 الدخول للتطبيق...");
  // هنا يتم التوجيه للصفحة الرئيسية للشجرة
  window.location.href = "tree.html";
};

function showTreeSelectionPanel() {
  const loginCards = document.querySelectorAll(
    ".login-panel:not(#tree-select-panel)"
  );
  loginCards.forEach((c) => (c.style.display = "none"));

  const selectionPanel = document.getElementById("tree-select-panel");
  if (selectionPanel) {
    selectionPanel.classList.remove("hidden");
    selectionPanel.style.display = "flex";
  }
}

/* ========================================= */
/* 4. إدارة تسجيل الدخول وإنشاء الحساب */
/* ========================================= */
window.toggleAuthMode = (e, forceLogin = false) => {
  if (e) e.preventDefault();

  if (forceLogin) isSignupMode = false;
  else isSignupMode = !isSignupMode;

  const nameGroup = document.getElementById("name-group");
  const title = document.getElementById("form-title");
  const btn = document.getElementById("btn-action");
  const switchTxt = document.getElementById("switch-text");
  const switchAct = document.getElementById("switch-action");

  if (isSignupMode) {
    nameGroup.classList.remove("hidden");
    title.innerText = "إنشاء حساب جديد";
    btn.innerText = "إنشاء الحساب";
    switchTxt.innerText = "عندك حساب؟";
    switchAct.innerText = "سجل الدخول";
  } else {
    nameGroup.classList.add("hidden");
    title.innerText = "تسجيل الدخول";
    btn.innerText = "تسجيل دخول";
    switchTxt.innerText = "انت جديد هنا؟ ";
    switchAct.innerText = "اعمل حساب جديد";
  }
};

window.handleAuthAction = async () => {
  const email = document.getElementById("auth-email").value.trim();
  const pass = document.getElementById("auth-password").value;
  const name = document.getElementById("auth-name").value.trim();
  const btn = document.getElementById("btn-action");

  if (!email)
    return window.showNotification(
      "⚠️ اكتب البريد الإلكتروني أولاً",
      "warning"
    );
  if (!pass) return window.showNotification("⚠️ اكتب كلمة المرور", "warning");
  if (isSignupMode && !name)
    return window.showNotification("⚠️ اكتب اسمك", "warning");

  const originalText = btn.innerText;
  btn.innerText = "جاري التحقق...";
  btn.disabled = true;

  try {
    if (isSignupMode) {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        pass
      );
      await updateProfile(userCredential.user, { displayName: name });
      await setDoc(doc(db, "users", userCredential.user.uid), {
        name: name,
        email: email,
        photoURL: "logo.png",
        createdAt: new Date().toISOString(),
        role: "user",
        linkedTreeId: null,
      });
      window.showNotification("تم إنشاء الحساب بنجاح! 🎉", "success");
    } else {
      await signInWithEmailAndPassword(auth, email, pass);
      window.showNotification("تم تسجيل الدخول بنجاح 👋", "success");
    }
  } catch (error) {
    console.error("Auth Error:", error);
    window.showNotification(getFriendlyErrorMessage(error), "error");
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
        role: "user",
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
        role: "user",
      });
    }
  } catch (error) {
    console.error(error);
    window.showNotification("فشل الدخول بفيسبوك", "error");
  }
};

/* ========================================= */
/* 5. استعادة كلمة المرور (المحسنة) */
/* ========================================= */
window.resetPassword = async (event) => {
  if (event) event.preventDefault();

  const emailInput = document.getElementById("auth-email");
  const linkElement = event.target;
  const email = emailInput.value.trim();

  if (!email) {
    const formContainer = document.querySelector(".auth-form-container");
    if (formContainer) {
      formContainer.style.animation = "shake 0.5s ease-in-out";
      setTimeout(() => (formContainer.style.animation = "none"), 500);
    }
    return window.showNotification(
      "⚠️ اكتب بريدك الإلكتروني في الخانة أعلاه أولاً",
      "warning"
    );
  }

  const originalText = linkElement.innerText;
  linkElement.innerText = "جاري الإرسال... ⏳";
  linkElement.style.pointerEvents = "none";

  try {
    await sendPasswordResetEmail(auth, email);
    window.showNotification(
      `تم إرسال رابط الاستعادة إلى ${email} 📧`,
      "success"
    );
    linkElement.innerText = "تم الإرسال! راجع بريدك ✅";
    linkElement.style.color = "#10b981";

    setTimeout(() => {
      linkElement.innerText = originalText;
      linkElement.style.pointerEvents = "auto";
      linkElement.style.color = "";
    }, 5000);
  } catch (error) {
    window.showNotification(getFriendlyErrorMessage(error), "error");
    linkElement.innerText = originalText;
    linkElement.style.pointerEvents = "auto";
  }
};

/* ========================================= */
/* 6. منطق الشجرة (إنشاء وبحث) */
/* ========================================= */
window.createNewTree = async () => {
  const user = auth.currentUser;
  if (!user) return window.showNotification("يرجى تسجيل الدخول أولاً", "error");

  const nameInput = document.getElementById("new-tree-name");
  const passInput = document.getElementById("new-tree-password");
  const religionInput = document.querySelector(
    'input[name="religion"]:checked'
  );

  const name = nameInput.value;
  const password = passInput.value;
  const religion = religionInput ? religionInput.value : "muslim";

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

    const firstMemberRef = await addDoc(
      collection(db, "trees", treeRef.id, "members"),
      {
        name: user.displayName || name,
        gender: "male",
        img: user.photoURL || "mainmale.png",
        isRoot: true,
        linkedUserId: user.uid,
        level: 0,
        createdAt: new Date().toISOString(),
      }
    );

    await updateDoc(doc(db, "users", user.uid), {
      linkedTreeId: treeRef.id,
      linkedMemberId: firstMemberRef.id,
      role: "admin",
      treeId: treeRef.id,
    });

    window.showNotification("تم الإنشاء! جاري الدخول...", "success");
    setTimeout(() => {
      window.location.href = "tree.html";
    }, 1000);
  } catch (error) {
    console.error("خطأ أثناء الإنشاء:", error);
    window.showNotification("حدث خطأ: " + error.message, "error");
    if (btn) {
      btn.innerText = "إنشاء الشجرة";
      btn.disabled = false;
    }
  }
};

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
      const q = query(
        collection(db, "trees"),
        where("name", ">=", term),
        where("name", "<=", term + "\uf8ff")
      );
      const querySnapshot = await getDocs(q);
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
                <strong style="color:white; display:block">${tree.name}</strong>
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
      console.error("Search Error:", error);
      resultsArea.innerHTML =
        '<div class="placeholder-text" style="color:#ff4757">خطأ في البحث</div>';
    }
  }, 500);
};

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
      if (treeDoc.data().password === inputPass) {
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
    window.showNotification("حدث خطأ في الاتصال", "error");
  }
};

window.closePasswordModal = () => {
  document.getElementById("password-challenge-modal").style.display = "none";
};

/* ========================================= */
/* 7. دوال التنقل والواجهة (UI Helpers) */
/* ========================================= */
window.showSearchTree = () => {
  document.getElementById("choice-main-view").classList.add("hidden");
  const view = document.getElementById("join-tree-view");
  view.classList.remove("hidden");
  view.classList.add("fade-in-view");
};

window.showCreateTree = () => {
  document.getElementById("choice-main-view").classList.add("hidden");
  const view = document.getElementById("create-tree-view");
  view.classList.remove("hidden");
  view.classList.add("fade-in-view");
};

window.backToChoiceMain = () => {
  document.getElementById("join-tree-view").classList.add("hidden");
  document.getElementById("create-tree-view").classList.add("hidden");

  const main = document.getElementById("choice-main-view");
  main.classList.remove("hidden");
  main.classList.add("fade-in-view");
};

window.logoutFromSelection = () => {
  signOut(auth).then(() => {
    window.showNotification("تم تسجيل الخروج", "info");
    setTimeout(() => location.reload(), 1000);
  });
};

/* دوال الموبايل */
window.showMobileLogin = () => {
  const intro = document.getElementById("intro-panel-content");
  const login = document.getElementById("login-panel-content");
  if (intro && login) {
    intro.style.display = "none";
    login.style.display = "flex";
    login.classList.remove("hidden");
    login.style.animation = "slideUp 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)";
  }
};

window.hideMobileLogin = () => {
  const intro = document.getElementById("intro-panel-content");
  const login = document.getElementById("login-panel-content");
  if (intro && login) {
    login.style.display = "none";
    intro.style.display = "flex";
    intro.style.animation = "fadeIn 0.5s ease-out";
  }
};

// Resize Listener
window.addEventListener("resize", () => {
  const loginPanel = document.getElementById("login-panel-content");
  const introPanel = document.getElementById("intro-panel-content");

  if (
    !document.getElementById("landing-page") ||
    document.getElementById("landing-page").style.display === "none"
  )
    return;

  if (window.innerWidth > 768) {
    if (introPanel) introPanel.style.display = "block";
    if (loginPanel) {
      loginPanel.style.display = "flex";
      loginPanel.classList.remove("hidden");
      loginPanel.style.animation = "none";
    }
  } else {
    if (loginPanel && loginPanel.style.display === "flex") {
      if (introPanel) introPanel.style.display = "none";
    } else {
      if (introPanel) introPanel.style.display = "flex";
      if (loginPanel) loginPanel.style.display = "none";
    }
  }
});

/* ========================================= */
/* 8. أدوات مساعدة (Notifications) */
/* ========================================= */
function getFriendlyErrorMessage(error) {
  const code = error.code;
  switch (code) {
    case "auth/wrong-password":
      return "🔑 كلمة المرور غير صحيحة!";
    case "auth/user-not-found":
      return "📧 البريد غير مسجل.";
    case "auth/email-already-in-use":
      return "✋ البريد مسجل بالفعل!";
    case "auth/invalid-email":
      return "📝 صيغة البريد غير صحيحة.";
    case "auth/weak-password":
      return "👮 كلمة المرور ضعيفة (6 أحرف على الأقل).";
    case "auth/invalid-credential":
      return "❌ بيانات الدخول غير صحيحة.";
    case "auth/network-request-failed":
      return "📡 فشل الاتصال بالإنترنت.";
    default:
      return "حدث خطأ: " + code;
  }
}

window.showNotification = (msg, type = "info") => {
  const container = document.getElementById("notification-container");
  if (!container) return alert(msg);

  const toast = document.createElement("div");
  toast.className = `toast-msg ${type}`;
  let icon = "🔔";
  if (type === "success") icon = "✅";
  if (type === "error") icon = "❌";
  if (type === "warning") icon = "⚠️";

  toast.innerHTML = `<span>${icon}</span> <span>${msg}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "slideDown 0.3s ease-in reverse forwards";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};
