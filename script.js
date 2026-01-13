/* ==========================================================================
   1. Firebase Initialization and Auth State Handling
   ========================================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
  setDoc,
  query,
  where,
  getDocs,
  writeBatch,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
window.currentMembers = [];
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

let currentUser = null;
let currentTreeId = null; // هنخزن فيه رقم الشجرة الحالية
let membersUnsubscribe = null;
/* ========================================= 
 2.(Anti-Freeze) 
 ========================================= */
// بيشيل شاشة التحميل إجبارياً بعد 4 ثواني لو علقت
setTimeout(() => {
  const loader = document.getElementById("loader-wrapper");
  if (loader && loader.style.display !== "none") {
    console.warn("⚠️ تم إخفاء شاشة التحميل إجبارياً لتجنب التعليق.");
    loader.style.opacity = "0";
    setTimeout(() => {
      loader.style.display = "none";
    }, 500);
  }
}, 4000);
/* ========================================= 
 2.Auth & Login
 ========================================= */
window.currentTreeId = null;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;

    try {
      // جلب بيانات المستخدم
      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);

      // تحديث النافبار (لو موجودة)
      const navImg = document.getElementById("nav-user-img");
      const navName = document.getElementById("dropdown-user-name");
      if (navImg) navImg.src = user.photoURL || "mainmale.png";
      if (navName) navName.innerText = user.displayName || "مستخدم";

      if (userSnap.exists()) {
        const userData = userSnap.data();
        const myTreeId = userData.linkedTreeId || userData.treeId;

        if (myTreeId) {
          // ✅ المستخدم لديه شجرة -> حمل البيانات
          window.currentTreeId = myTreeId;
          loadTreeData(window.currentTreeId);
        } else {
          // 🚀 المستخدم ليس لديه شجرة -> وجهه للصفحة الرئيسية للإنشاء
          // (بدلاً من إظهار القائمة القديمة هنا)
          window.location.href = "index.html";
        }
      } else {
        // حساب جديد كلياً -> التوجيه لصفحة الإنشاء
        window.location.href = "index.html";
      }
    } catch (error) {
      console.error("❌ خطأ في جلب البيانات:", error);
      window.location.href = "index.html"; // في حالة الخطأ ارجع للبداية
    }
  } else {
    // لا يوجد مستخدم
    const loader = document.getElementById("loader-wrapper");
    if (loader) loader.style.display = "none";
  }
});
// 2. دالة فتح/غلق قائمة البروفايل
window.toggleProfileMenu = () => {
  const menu = document.getElementById("profile-dropdown");
  menu.classList.toggle("active");
};

// 3. إغلاق القائمة عند الضغط خارجها
document.addEventListener("click", (e) => {
  const menu = document.getElementById("profile-dropdown");
  const avatarBtn = document.querySelector(".user-avatar-btn");

  if (
    menu &&
    menu.classList.contains("active") &&
    !menu.contains(e.target) &&
    !avatarBtn.contains(e.target)
  ) {
    menu.classList.remove("active");
  }
});

// 4. دالة زر "ملفي الشخصي" (توديك عند الفرد المرتبط بيك في الشجرة)
window.openMyProfileSettings = () => {
  if (window.currentUserLinkedMemberId) {
    window.openBio(window.currentUserLinkedMemberId);
    window.toggleProfileMenu(); // قفل القائمة
  } else {
    alert("أنت غير مرتبط بشخصية في الشجرة بعد!");
  }
};

/* ========================================= 
 3. Create New Tree Flow  
 ========================================= */
window.startNewTreeFlow = async () => {
  const familyName = prompt("اكتب اسم العائلة (مثلاً: عائلة جرجس):");
  if (!familyName) return;

  const password = prompt(
    "عين كلمة سر للعائلة (مهم جداً لمشاركتها مع أقاربك):"
  );
  if (!password) return alert("لازم كلمة سر!");

  try {
    // 1. إنشاء الشجرة في الداتابيز
    const treeRef = await addDoc(collection(db, "trees"), {
      familyName: familyName,
      password: password,
      creatorId: currentUser.uid,
      createdAt: new Date().toISOString(),
      ownerId: currentUser.uid,
      adminPermissions: {},
    });

    // 2. إنشاء أول فرد (الجذر) - اللي هو أنت
    await addDoc(collection(db, "trees", treeRef.id, "members"), {
      name: currentUser.displayName,
      gender: "male", // افتراضي
      img: currentUser.photoURL || "mainmale.png",
      level: 0,
      isRoot: true,
      linkedUserId: currentUser.uid, // ربطك بيه فوراً
    });

    // 3. تحديث بياناتك إنك تبع الشجرة دي
    await setDoc(
      doc(db, "users", currentUser.uid),
      {
        linkedTreeId: treeRef.id,
        linkedMemberId: "ROOT", // علامة إنك المؤسس
      },
      { merge: true }
    );

    alert(`مبروك! تم إنشاء ${familyName}. الباسورد هو: ${password}`);
    window.location.reload();
  } catch (e) {
    console.error(e);
    alert("حدث خطأ: " + e.message);
  }
};

/* ========================================= 
 4. join Existing Tree Flow
 ========================================= */
window.showJoinPopup = () => {
  const familyName = prompt("اكتب اسم العائلة للبحث عنها:");
  if (familyName) searchAndJoin(familyName);
};

async function searchAndJoin(name) {
  // بحث عن العائلة
  const q = query(collection(db, "trees"), where("familyName", "==", name));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return alert("لم يتم العثور على عائلة بهذا الاسم.");

  // نفترض أول نتيجة هي المطلوبة (ممكن نطورها بعدين)
  const treeDoc = snapshot.docs[0];
  const treeData = treeDoc.data();

  // طلب الباسورد
  const inputPass = prompt(
    `تم العثور على "${treeData.familyName}". أدخل كلمة السر للانضمام:`
  );

  if (inputPass === treeData.password) {
    // الباسورد صح! نربط المستخدم
    await setDoc(
      doc(db, "users", currentUser.uid),
      {
        linkedTreeId: treeDoc.id,
        linkedMemberId: null, // لسه هيختار هو مين
        email: currentUser.email,
      },
      { merge: true }
    );

    alert(
      "تم الانضمام بنجاح! سيتم توجيهك للشجرة.. ابحث عن نفسك واضغط 'هذا أنا'."
    );
    window.location.reload();
  } else {
    alert("كلمة السر خاطئة! ❌");
  }
}

/* ========================================= 
 5. load Tree Data and Real-time Updates  
 ========================================= */
function loadTreeData(treeId) {
  // 1. تنظيف الشاشة فوراً لمنع تداخل الأشجار (حل مشكلة الـ 3 أشخاص)
  const container = document.getElementById("tree-container");
  if (container) container.innerHTML = "";
  window.currentMembers = [];

  // إخفاء شاشة البداية وإظهار التطبيق
  const onboarding = document.getElementById("onboarding-screen");
  if (onboarding) onboarding.remove();
  document.querySelector(".main-wrapper").style.display = "block";

  getDoc(doc(db, "trees", treeId)).then((snap) => {
    if (snap.exists()) {
      window.treeCreatorId = snap.data().creatorId;
    }
  });

  getDoc(doc(db, "users", currentUser.uid)).then((snap) => {
    if (snap.exists()) {
      window.currentUserLinkedMemberId = snap.data().linkedMemberId;
    }
  });

  const membersRef = collection(db, "trees", treeId, "members");

  if (membersUnsubscribe) membersUnsubscribe();

  membersUnsubscribe = onSnapshot(
    membersRef,
    (snapshot) => {
      // تنظيف المصفوفة
      window.currentMembers = [];

      // تنظيف الكونتينر مرة ثانية للتأكيد عند كل تحديث
      if (container) container.innerHTML = "";

      snapshot.docs.forEach((doc) => {
        window.currentMembers.push({ ...doc.data(), id: doc.id });
      });

      renderPerspectiveTree();
      checkAdminStatus(); // رسم الشجرة الجديدة
      document.getElementById("loader-wrapper").style.display = "none";
    },
    (error) => {
      console.error("Error loading tree:", error);
      alert("مشكلة في تحميل البيانات (تأكد من الصلاحيات).");
    }
  );
}

/* =========================================
  6. Help Tour System
 ========================================= */

let currentTourStep = 0;

// دالة لفتح بروفايل "وهمي" للشرح
function openDummyBio() {
  const modal = document.getElementById("bio-modal");
  const editSec = document.getElementById("edit-section");
  const addSec = document.getElementById("add-section");
  const viewSec = document.getElementById("view-section");

  // 1. تصفير العرض (إظهار العرض فقط)
  modal.style.display = "flex";
  viewSec.style.display = "block";
  editSec.style.display = "none";
  addSec.style.display = "none";

  // 2. تعبئة بيانات وهمية
  document.getElementById(
    "modal-name"
  ).innerHTML = `الاسم <span class="father-name-tag">(اسم الأب)</span>`;
  document.getElementById("modal-age").innerText = "السن";
  document.getElementById("modal-img").src = "logo.png"; // نستخدم اللوجو كصورة مؤقتة
  document.getElementById("modal-id-display").innerText = "dummy_id";

  // تنظيف الأوسمة
  document.getElementById("extra-info-badges").innerHTML = `
    <div class="info-badge badge-gen"><i>🧬</i> جيل تجريبي</div>
  `;
}
// تعريف خطوات الجولة التفصيلية والشاملة
const tourSteps = [
  // --- مقدمة ---
  {
    target: null,
    title: "👋 أهلاً بك في الدليل الشامل",
    desc: "سنأخذك في جولة كاملة لشرح كل زر وكل خاصية في النظام بالتفصيل الممل.",
  },

  // --- شريط الأدوات العلوي (Navbar) ---

  {
    target: ".search-wrapper",
    title: "🔍 البحث السريع",
    desc: "اكتب اسم أي شخص للوصول إليه فوراً. القائمة تظهر النتائج مع اسم الأب لسهولة التمييز.",
  },

  {
    target: "button[onclick='window.toggleMaternalRelatives()']",
    title: "👀 إظهار/إخفاء الأخوال",
    desc: "للتحكم في زحمة الشجرة. يمكنك إخفاء فرع عائلة الأم (الأخوال والخالات) والتركيز على العصب فقط.",
  },
  {
    target: "button[onclick='window.openRelCalc()']",
    title: "🔮 حاسبة القرابة",
    desc: "أداة ذكية: تختار شخصين، والنظام يقول لك (ده ابن عم والدك) أو (دي خالة جدك) بدقة.",
  },
  {
    target: "button[onclick='window.toggleTheme()']",
    title: "🌗 الوضع الليلي/النهاري",
    desc: "للتبديل بين المظهر الداكن (Dark Mode) والمظهر الفاتح (Light Mode).",
  },
  {
    target: "button[onclick='window.exportTreeImage()']",
    title: "📸 لقطة الشاشة",
    desc: "تحميل الشجرة الحالية كصورة عالية الجودة (PNG) بخلفية شفافة لمشاركتها.",
  },
  {
    target: "button[onclick='window.showStatsModal()']",
    title: "📊 الإحصائيات",
    desc: "لوحة تعرض أرقاماً حقيقية: عدد الذكور/الإناث، متوسط الأعمار، وأكثر الأسماء انتشاراً.",
  },
  // --- الشجرة ---
  {
    target: "#tree-container",
    position: "center", // أمر خاص لتوسط الشرح
    title: "🌲 الشجرة التفاعلية",
    desc: "هنا تظهر العائلة. اسحب للتحرك، واستخدم الزوم للتكبير.<br><b>اضغط على أي كارت</b> لفتح خياراته.",
  },
  // --- الملف الشخصي (سيفتح تلقائياً) ---
  {
    action: "open_dummy", // فتح المودال الوهمي
    target: "#bio-modal .modal-content",
    position: "left", // نجبر الشرح يجي شمال المودال
    title: "👤 ملف الشخص",
    desc: "هنا تظهر بيانات الفرد. يمكنك التحكم فيه من الأزرار بالأسفل.",
  },
  {
    target: "button[onclick='window.switchProfile()']",
    title: "👁️ التركيز (Focus)",
    desc: "يجعل هذا الشخص هو <b>مركز الشجرة</b>، ويظهر أقاربه المباشرين فقط (أب، أم، أبناء، إخوة).",
  },
  // --- قسم الإضافة ---
  {
    action: "open_add",
    target: "#add-section",
    title: "➕ إضافة قريب",
    desc: "لإضافة (ابن، أب، زوج، إلخ). <br>اختر صلة القرابة واملأ البيانات.",
  },
  {
    target: "#new-name",
    title: "👶 بيانات الجديد",
    desc: "اكتب اسم الشخص الجديد.",
  },
  {
    target: "#new-dob",
    title: "📅 تاريخ الميلاد",
    desc: "حدد تاريخ الميلاد بدقة. هذا يساعد النظام في:<br>• حساب السن تلقائياً.<br>• تحديد البرج الفلكي والجيل.<br>• التنبيه بأعياد الميلاد.",
  },
  {
    target: "#new-gender", // استهداف خانة النوع والصلة
    title: "النوع ",
    desc: "حدد هل هو (ذكر/أنثى) .",
  },
  {
    target: "#relation-type",
    title: "🔗 صلة القرابة",
    desc: "أهم خانة! حدد: هل الجديد ده (ابن) للشخص الحالي؟ ولا (أخوه)؟ ولا (والده)؟",
  },
  {
    target: "#new-img",
    title: "🖼️ صورة الشخص",
    desc: "ضع رابط الصورة هنا. <br>💡 <b>نصيحة:</b> إذا تركتها فارغة، سيضع النظام صورة كرتونية (أفاتار) تلقائياً حسب النوع.",
  },

  {
    target: "#new-existing-member",
    title: "🔄 ربط شخص موجود",
    desc: "لو الشخص الجديد ده أصلاً موجود في الشجرة (مثلاً ابن عم وعايز تربطه كزوج)، اختاره من هنا بدل ما تكتب اسمه تاني.",
  },

  // --- قسم التعديل ---
  {
    action: "open_edit", // فتح قسم التعديل
    target: "#edit-section",
    title: "✏️ وضع التعديل",
    desc: "لتصحيح البيانات الخاطئة.",
  },
  {
    target: "#edit-img",
    title: "🖼️ تغيير الصورة",
    desc: "ضع رابط صورة جديد هنا، أو استخدم زر الحذف لاستعادة الصورة الافتراضية.",
  },
  {
    target: "#edit-existing-spouse",
    title: "💍 ربط الزواج",
    desc: "لو الزوج/الزوجة مضافين بالفعل في الشجرة، اختارهم من القائمة دي لربطهم ببعض.",
  },
  {
    target: ".btn-add-link-small",
    title: "📱 السوشيال ميديا",
    desc: "أضف روابط فيسبوك، واتساب، أو رقم هاتف لتظهر في البروفايل.",
  },
  {
    target: ".mini-switch-wrapper",
    title: "🚫 إخفاء من الشجرة",
    desc: "لو الشخص ده مش عايزينه يظهر في الشجرة الرئيسية (لأي سبب)، فعل الزر ده.",
  },

  // --- باقي الأزرار ---
  {
    action: "back_to_view", // الرجوع للعرض
    target: "button[onclick='window.deleteMember()']",
    title: "🗑️ حذف",
    desc: "حذف الشخص نهائياً من العائلة. (لا يمكن التراجع!)",
  },
  {
    target: ".social-dropdown",
    title: "💬 التواصل",
    desc: "قائمة تظهر فيها أرقام وروابط السوشيال ميديا اللي ضفتها للشخص ده.",
  },
  {
    target: "button[onclick='window.shareMember()']",
    title: "🔗 مشاركة الرابط",
    desc: "نسخ رابط مباشر يفتح الشجرة على هذا الشخص تحديداً.",
  },

  // --- الختام ---
  {
    action: "close_modal",
    target: null,
    title: "🎉 انتهت الجولة",
    desc: "أنت الآن خبير في النظام! انطلق وابنِ شجرتك.",
  },
];

window.startTour = () => {
  currentTourStep = 0;
  // منع السكرول في الجسم عند بدء التور
  document.body.style.overflow = "hidden";
  document.getElementById("tour-overlay").style.display = "block";
  document.getElementById("tour-overlay").style.zIndex = "4000";
  handleStepLogic();
};

window.endTour = () => {
  document.getElementById("tour-overlay").style.display = "none";
  const hl = document.getElementById("tour-highlight-box");
  hl.style.width = "0";
  hl.style.height = "0";

  // إعادة السكرول لطبيعته (أو حسب إعدادات CSS الخاصة بك)
  document.body.style.overflow = "";

  window.closeBio(); // إغلاق المودال عند الخروج
};

window.nextTourStep = () => {
  currentTourStep++;
  if (currentTourStep >= tourSteps.length) {
    window.endTour();
  } else {
    handleStepLogic();
  }
};

// التحكم المنطقي في فتح/غلق النوافذ
function handleStepLogic() {
  const step = tourSteps[currentTourStep];

  // تعريف العناصر للتحكم فيها
  const editSec = document.getElementById("edit-section");
  const addSec = document.getElementById("add-section");
  const viewSec = document.getElementById("view-section");

  if (step.action === "open_dummy") {
    openDummyBio();
  } else if (step.action === "open_edit") {
    // إخفاء كل شيء وفتح التعديل فقط
    viewSec.style.display = "none";
    addSec.style.display = "none";
    editSec.style.display = "block";
  } else if (step.action === "open_add") {
    // إخفاء كل شيء وفتح الإضافة فقط (حل مشكلة التداخل)
    viewSec.style.display = "none";
    editSec.style.display = "none";
    addSec.style.display = "block";
  } else if (step.action === "back_to_view") {
    // العودة للعرض
    editSec.style.display = "none";
    addSec.style.display = "none";
    viewSec.style.display = "block";
  } else if (step.action === "close_modal") {
    window.closeBio();
  }

  // تأخير بسيط للرسم
  setTimeout(() => renderTourStep(), 300);
}

function renderTourStep() {
  const step = tourSteps[currentTourStep];
  const highlightBox = document.getElementById("tour-highlight-box");
  const tooltip = document.getElementById("tour-tooltip");

  // تحديث النصوص
  document.getElementById("tour-title").innerText = step.title;
  document.getElementById("tour-desc").innerHTML = step.desc;
  document.getElementById("tour-step-count").innerText = `${
    currentTourStep + 1
  } / ${tourSteps.length}`;

  const nextBtn = document.querySelector(".btn-tour-next");
  nextBtn.innerText =
    currentTourStep === tourSteps.length - 1 ? "إنهاء ✅" : "التالي ❯";

  if (step.target) {
    const el = document.querySelector(step.target);
    // ننتظر قليلاً للتأكد أن العنصر مرئي (خاصة المودال)
    if (el && el.offsetParent !== null) {
      const rect = el.getBoundingClientRect();

      // 1. رسم الهايلايت بدقة حول العنصر
      const padding = 10; // مسافة أمان
      highlightBox.style.width = `${rect.width + padding}px`;
      highlightBox.style.height = `${rect.height + padding}px`;
      highlightBox.style.top = `${rect.top - padding / 2}px`;
      highlightBox.style.left = `${rect.left - padding / 2}px`;
      highlightBox.style.opacity = "1";

      // 2. حساب مكان الشرح بذكاء
      const tooltipWidth = 320;
      const tooltipHeight = tooltip.offsetHeight || 200;
      const gap = 20; // مسافة بين الهايلايت والشرح

      let top, left;

      // أ) حالة التوسط (للشجرة)
      if (step.position === "center") {
        top = window.innerHeight / 2 + 50;
        left = window.innerWidth / 2 - tooltipWidth / 2;
      }
      // ب) إجبار الوضع يسار العنصر (للمودال عشان ميغطيوش)
      else if (step.position === "left") {
        // نحاول نحطه على الشمال
        left = rect.left - tooltipWidth - gap;
        top = rect.top;

        // لو مفيش مكان على الشمال (الشاشة صغيرة)، نخليه تحت
        if (left < 10) {
          left = window.innerWidth / 2 - tooltipWidth / 2; // سنتر
          top = rect.bottom + gap; // تحت
        }
      }
      // ج) الوضع الافتراضي (أسفل العنصر)
      else {
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
      }

      // د) تصحيح الخروج عن الشاشة (Boundary Check Logic)

      // تصحيح العمودي
      if (top + tooltipHeight > window.innerHeight) {
        // لو نزل تحت الشاشة، نطلعه فوق العنصر
        top = rect.top - tooltipHeight - gap;
      }
      if (top < 10) top = 10; // لو طلع فوق الشاشة، نثبته

      // تصحيح الأفقي
      if (left < 10) left = 10;
      if (left + tooltipWidth > window.innerWidth) {
        left = window.innerWidth - tooltipWidth - 10;
      }

      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;
      tooltip.style.transform = "none";

      // سكرول للعنصر ماعدا الشجرة
      if (step.target !== "#tree-container") {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else {
      // لو العنصر مش موجود، نعرض في النص وخلاص
      centerTooltip(highlightBox, tooltip);
    }
  } else {
    centerTooltip(highlightBox, tooltip);
  }
}

function centerTooltip(box, tip) {
  // نخفي صندوق الهايلايت بجعله بحجم الشاشة كلها تقريباً أو إخفاؤه
  // الطريقة الأجمل: جعل الهايلايت يختفي تماماً (شفاف)
  box.style.opacity = "0";

  // توسيط الشرح
  tip.style.top = "50%";
  tip.style.left = "50%";
  tip.style.transform = "translate(-50%, -50%)";
}
/* =========================================
 7. Back
 ========================================= */
window.toggleAppMode = () => {
  const body = document.body;

  // 1. تبديل الكلاس فقط (CSS سيتولى إظهار/إخفاء الأزرار)
  body.classList.toggle("admin-mode");

  // تم إزالة window.customAlert وأي تغيير للنصوص
};
let currentFocusId = null;
let viewMode = "full";
let confettiInterval = null;
let navHistory = []; // قائمة لحفظ سجل التنقلات
/* دالة الرجوع للخلف خطوة واحدة */
window.goBack = () => {
  animateTransition(() => {
    if (navHistory.length > 0) {
      const lastId = navHistory.pop();
      currentFocusId = lastId;
      viewMode = "perspective";
    } else {
      window.showFullTree();
    }
    refreshUI();
  });
};

/* =========================================
 8. Toggle Maternal Relatives View
 ========================================= */
window.showMaternal = false; // افتراضياً مخفي لتقليل الزحمة
window.toggleMaternalRelatives = () => {
  window.showMaternal = !window.showMaternal;

  // تحديث نص الزر
  const label = document.getElementById("maternal-label");
  if (label) {
    label.innerText = window.showMaternal ? "إخفاء الأخوال" : "إظهار الأخوال";
  }

  // إعادة بناء الواجهة ليعكس التغيير
  refreshUI();
};
/* =========================================
 9. Shared Link Handling
 ========================================= */
/* التحقق من وجود ID في الرابط عند فتح الصفحة */
const urlParams = new URLSearchParams(window.location.search);
const sharedId = urlParams.get("id");

if (sharedId) {
  currentFocusId = sharedId;
  viewMode = "perspective";
}
/* =========================================
 10. Relation Names in Arabic
 ========================================= */
const relationNames = {
  child: { male: "ابنـي", female: "بنتـي" },
  sibling: { male: "أخويـا", female: "أختـي" },
  parent: { male: "أبـويا", female: "أمـي" },
  spouse: { male: "جوزي", female: "مراتـي" },
  uncle_aunt: { male: "عمـي", female: "عمتـي" },
  maternal_sibling: { male: "خالـي", female: "خالتـي" },
};

let isFirstLoad = true; // تعريف المتغير في النطاق العام

/* =========================================
 11. UI Refresh with Smart Delay for Drawing Lines
 ========================================= */
function refreshUI() {
  if (!window.currentMembers || window.currentMembers.length === 0) {
    renderEmptyState();
    return;
  }

  // 1. مسح الخطوط القديمة فوراً (عشان متبقاش ظاهرة غلط أثناء التحميل)
  const svg = document.getElementById("tree-svg");
  if (svg) svg.innerHTML = "";

  // 2. بناء الشجرة
  if (viewMode === "full") renderFullTree(window.currentMembers);
  else renderPerspectiveTree(currentFocusId, window.currentMembers);

  // 3. ضبط الحجم
  fitTreeToScreen();

  // 4. [التعديل هنا]: تأخير رسم الخطوط
  // لغينا الرسم الفوري (requestAnimationFrame) اللي كان بيعمل مشاكل
  // وخليناه يستنى 800 مللي ثانية (قريب من ثانية) عشان نضمن ان كل حاجة استقرت
  setTimeout(() => {
    // نطلب الرسم دلوقتي بعد ما الصفحة هديت
    requestAnimationFrame(() => {
      if (window.currentMembers) {
        drawLines(window.currentMembers);
      }
    });
  }, 850); // يمكنك زيادة الرقم لـ 1000 لو لسا بتحصل مشاكل
}

/* =========================================
 12. Render Full Tree with Privacy Filter
 ========================================= */
function renderFullTree(members) {
  const container = document.getElementById("tree-container");
  const svg = document.getElementById("tree-svg");
  container.innerHTML = "";
  svg.innerHTML = "";

  // التصفية: إظهار فقط الأشخاص غير المخفيين (السلالة الأساسية)
  const bloodline = members.filter((m) => !m.isPrivate);

  const levels = {};
  bloodline.forEach((m) => {
    const lvl = m.level || 1;
    if (!levels[lvl]) levels[lvl] = [];
    levels[lvl].push(m);
  });

  Object.keys(levels)
    .sort((a, b) => a - b)
    .forEach((lvl, idx) => {
      const div = document.createElement("div");
      div.className = `level level-depth-${lvl}`;
      if (idx > 0) {
        const prevLvl =
          levels[Object.keys(levels).sort((a, b) => a - b)[idx - 1]];
        levels[lvl].sort(
          (a, b) =>
            prevLvl.findIndex((p) => p.id === a.parent) -
            prevLvl.findIndex((p) => p.id === b.parent)
        );
      }
      levels[lvl].forEach((m) => createCardIn(div, m, ""));
      container.appendChild(div);
    });
}
/* =========================================
 13. Render Perspective Tree with Separate Maternal Uncles
 ========================================= */
function renderPerspectiveTree(focusId, allMembers) {
  // === [تصحيح الخطأ] ===
  // 1. لو البيانات لم تُرسل للدالة، نستخدم البيانات العالمية المحملة
  allMembers = allMembers || window.currentMembers || [];

  // 2. لو القائمة فارغة، نوقف الرسم فوراً لمنع الخطأ
  if (allMembers.length === 0) {
    return;
  }

  viewMode = "perspective";
  const container = document.getElementById("tree-container");
  const svg = document.getElementById("tree-svg");

  if (container) container.innerHTML = "";
  if (svg) svg.innerHTML = "";

  // 3. تحديد الشخصية: لو مفيش ID، نستخدم آخر مكان كنا فيه، أو نبحث عن المؤسس
  let targetId = focusId || window.lastFocusId;
  let person = allMembers.find((m) => m.id === targetId);

  // لو مش لاقيين الشخص (مثلاً أول مرة نفتح)، ندور على الجذر (Root)
  if (!person) {
    person = allMembers.find((m) => m.isRoot);
  }

  // لو لسه مفيش شخص، نوقف أو نعرض الشجرة الكاملة
  if (!person) return window.showFullTree();

  window.lastFocusId = person.id; // حفظ المكان الحالي

  const isMale = person.gender === "male";

  // 1. تحديد الأزواج
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const spouses = allMembers.filter((m) => {
    // هل هو مربوط كزوج؟
    const isLinkedSpouse = m.id === person.spouse || m.spouse === focusId;

    if (!isLinkedSpouse) return false;

    // الشرط السحري: التحقق من التاريخ
    // بنشوف تاريخ الزواج عند الشخص ده أو عند الشخص الأساسي
    const mDateStr = m.marriageDate || person.marriageDate;

    if (mDateStr) {
      const mDate = new Date(mDateStr);
      mDate.setHours(0, 0, 0, 0);
      // لو تاريخ الزواج أكبر من النهاردة (لسه مجاش) -> نخفيه (return false)
      if (mDate > today) return false;
    }

    return true; // إظهار الزوج لأنه تاريخه قديم أو النهاردة
  });
  const spouseIds = spouses.map((s) => s.id);
  const spouseId =
    person.spouse || allMembers.find((m) => m.spouse === focusId)?.id;

  // 2. الأبناء
  const fatherOfChildrenId = isMale
    ? focusId
    : spouseId
    ? spouseId
    : "NO_MATCH";
  const children = allMembers.filter((m) => m.parent === fatherOfChildrenId);

  // 3. الأب والجد (من ناحية الأب فقط - وهذا سر عدم رسم خطوط الأخوال)
  const father = person.parent
    ? allMembers.find((m) => m.id === person.parent)
    : null;
  const grandfather =
    father && father.parent
      ? allMembers.find((m) => m.id === father.parent)
      : null;

  // 4. الأم
  const mother = father
    ? allMembers.find((m) => m.id === father.spouse || m.spouse === father.id)
    : null;

  // 5. الأعمام (إخوة الأب)
  const uncles =
    father && father.parent
      ? allMembers.filter(
          (m) => m.parent === father.parent && m.id !== father.id
        )
      : [];

  // 6. الأخوال (إخوة الأم)
  const maternalUncles =
    mother && mother.parent && window.showMaternal
      ? allMembers.filter(
          (m) => m.parent === mother.parent && m.id !== mother.id
        )
      : [];

  // 7. الإخوة (إخوتي)
  const siblings = person.parent
    ? allMembers.filter(
        (m) =>
          m.parent === person.parent &&
          m.id !== focusId &&
          !spouseIds.includes(m.id)
      )
    : [];

  // --- بناء الهيكل ---
  // لاحظ: تم إضافة قسم خاص للأخوال (mat-section)
  container.innerHTML = `
    <div class="level"><div id="g-row" class="level"></div></div>
    
    <div class="level"><div id="p-row" class="level"></div></div>
    
    <div id="mat-section" class="level" style="display:none">
        <div id="mat-row" class="level"></div>
    </div>

    <div class="level"><div id="m-row" class="level">
        <div id="siblings-group" class="level-group"></div>
        <div id="main-couple" class="couple-wrapper"></div>
    </div></div>
    
    <div class="level"><div id="c-row" class="level"></div></div>
  `;

  // --- توزيع الكروت ---

  if (grandfather)
    createCardIn(document.getElementById("g-row"), grandfather, "جدي");

  if (father)
    createCardIn(
      document.getElementById("p-row"),
      father,
      relationNames.parent[father.gender] || "ابـويا"
    );

  uncles.forEach((u) =>
    createCardIn(
      document.getElementById("p-row"),
      u,
      relationNames.uncle_aunt[u.gender]
    )
  );

  // منطق إظهار الأخوال
  if (maternalUncles.length > 0) {
    document.getElementById("mat-section").style.display = "flex";
    maternalUncles.forEach((mu) =>
      createCardIn(
        document.getElementById("mat-row"),
        mu,
        relationNames.maternal_sibling
          ? relationNames.maternal_sibling[mu.gender]
          : "خال/خالة"
      )
    );
  }

  // الكروت الأساسية
  createCardIn(
    document.getElementById("main-couple"),
    person,
    "انـا",
    "highlight"
  );
  spouses.forEach((s) =>
    createCardIn(
      document.getElementById("main-couple"),
      s,
      relationNames.spouse[s.gender],
      "spouse-card"
    )
  );

  siblings.forEach((s) =>
    createCardIn(
      document.getElementById("siblings-group"),
      s,
      relationNames.sibling[s.gender]
    )
  );

  children.forEach((c) =>
    createCardIn(
      document.getElementById("c-row"),
      c,
      relationNames.child[c.gender]
    )
  );
}
/* =========================================
 14. Search Member Functionality
 ========================================= */
window.searchMember = () => {
  const val = document.getElementById("search-input").value.toLowerCase();
  const resDiv = document.getElementById("search-results");
  resDiv.innerHTML = "";

  if (!val) {
    resDiv.style.display = "none";
    return;
  }

  const matches = window.currentMembers.filter((m) =>
    m.name.toLowerCase().includes(val)
  );

  if (matches.length > 0) {
    resDiv.style.display = "block";
    matches.forEach((m) => {
      const parent = window.currentMembers.find((p) => p.id === m.parent);
      const parentInfo = parent ? `(${parent.name})` : "";

      const d = document.createElement("div");
      d.className = "search-item";
      d.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px;">
          <img src="${m.img}" style="width:35px; height:35px; border-radius:50%; object-fit:cover; border: 1px solid var(--glass-border);">
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <span style="font-weight: 600; font-size: 0.9rem;">${m.name}</span>
            <span style="font-size: 0.75rem; opacity: 0.6; color: var(--text-main);">
              ${parentInfo}
            </span>
          </div>
        </div>
      `;

      d.onclick = () => {
        // تمرير m.id للدالة عشان لو الكارت موجود يعمل زوم عليه
        animateTransition(() => {
          if (currentFocusId && currentFocusId !== m.id) {
            navHistory.push(currentFocusId);
          }
          currentFocusId = m.id;
          viewMode = "perspective";
          refreshUI();
        }, m.id); // <--- التعديل هنا

        document.getElementById("search-input").value = "";
        resDiv.style.display = "none";
      };
      resDiv.appendChild(d);
    });
  } else {
    resDiv.style.display = "none";
  }
};
window.addEventListener("click", (e) => {
  const searchWrapper = document.querySelector(".search-wrapper");
  const resultsDiv = document.getElementById("search-results");

  // إذا كان الضغط خارج حاوية البحث، نخفي النتائج
  if (searchWrapper && resultsDiv) {
    if (!searchWrapper.contains(e.target)) {
      resultsDiv.style.display = "none";
    }
  }
});
/* =========================================
 15. Edit Member Section Logic
 ========================================= */
window.toggleEditSection = (show) => {
  const id = document.getElementById("modal-id-display").innerText;
  const m = window.currentMembers.find((x) => x.id === id);

  document.getElementById("edit-section").style.display = show
    ? "block"
    : "none";
  document.getElementById("view-section").style.display = show
    ? "none"
    : "block";

  if (show) {
    // تعبئة البيانات الأساسية
    document.getElementById("edit-name").value = m.name;
    document.getElementById("edit-img").value = m.img;
    document.getElementById("edit-dob").value = m.dob || "";
    // ... باقي الحقول ...

    // === [تحديث قائمة اختيار الزوج بذكاء] ===
    const spouseSelect = document.getElementById("edit-existing-spouse");

    // الحالة 1: متزوج (نقفل القائمة ونعرض الزوج)
    if (m.spouse) {
      const spouse = window.currentMembers.find((x) => x.id === m.spouse);
      spouseSelect.innerHTML = `<option value="${m.spouse}" selected>${
        spouse ? spouse.name : "زوج حالي"
      }</option>`;
      spouseSelect.disabled = true;
    }
    // الحالة 2 [جديد]: مخطوب (نقفل القائمة ونعرض الخطيب)
    else if (m.fiance) {
      const fiance = window.currentMembers.find((x) => x.id === m.fiance);
      spouseSelect.innerHTML = `<option value="${m.fiance}" selected>${
        fiance ? fiance.name : "خطيب حالي"
      } (💍)</option>`;
      spouseSelect.disabled = true; // ممنوع التغيير من هنا
    }
    // الحالة 3: أعزب (نعرض المتاحين فقط)
    else {
      spouseSelect.disabled = false;
      // رسالة حسب الجنس
      const defaultText =
        m.gender === "male" ? "-- ربط بزوجة موجودة --" : "-- ربط بزوج موجود --";
      spouseSelect.innerHTML = `<option value="">${defaultText}</option>`;

      window.currentMembers.forEach((member) => {
        if (member.id === m.id) return; // مش نفسه

        // 1. فلتر الشرع (الجنس + القرابة)
        if (!isMarriageAllowed(m, member)) return;

        // 2. فلتر الحالة (ممنوع يختار حد متجوز أو مخطوب)
        if (member.spouse) return;
        if (member.fiance) return;

        // إضافة للقائمة
        const option = document.createElement("option");
        option.value = member.id;
        option.text = member.name;
        spouseSelect.appendChild(option);
      });
    }
    // ==========================================

    // (باقي كود إظهار أزرار الطلاق والفسخ زي ما هو...)
    const breakEngBtn = document.getElementById("break-engagement-btn");
    const breakMarBtn = document.getElementById("break-marriage-btn");

    // ... نفس الكود اللي عملناه قبل كده لأزرار الفسخ ...
    if (m.spouse) {
      const spouse = window.currentMembers.find((x) => x.id === m.spouse);
      const sName = spouse ? spouse.name : "الشريك";
      breakMarBtn.style.display = "block";
      breakMarBtn.innerHTML = `📜 إنهاء الزواج من ${sName}`;
      breakEngBtn.style.display = "none";
    } else if (m.fiance && !m.spouse) {
      const fiance = window.currentMembers.find((x) => x.id === m.fiance);
      const fName = fiance ? fiance.name : "الخطيب/ة";
      breakEngBtn.style.display = "block";
      breakEngBtn.innerHTML = `💔 فسخ الخطوبة من ${fName}`;
      breakMarBtn.style.display = "none";
    } else {
      breakEngBtn.style.display = "none";
      breakMarBtn.style.display = "none";
    }
  }
};
/* =========================================
 16. Break Engagement Functionality
 ========================================= */
window.breakEngagement = async () => {
  const id = document.getElementById("modal-id-display").innerText;
  const m = window.currentMembers.find((x) => x.id === id);

  if (!m.fiance) return;

  const confirmBreak = confirm(
    "هل أنت متأكد من فسخ الخطوبة؟ 💔\nسيتم فك الارتباط فوراً."
  );
  if (!confirmBreak) return;

  const partnerId = m.fiance;

  try {
    // حذف بيانات الخطوبة من الطرفين
    await updateDoc(doc(db, "members", id), {
      fiance: null,
      engagementDate: null,
    });

    if (partnerId) {
      await updateDoc(doc(db, "members", partnerId), {
        fiance: null,
        engagementDate: null,
      });
    }

    window.customAlert("تم فسخ الخطوبة 💔");
    window.toggleEditSection(false); // الرجوع للبروفايل
    window.openBio(id); // تحديث الواجهة
  } catch (e) {
    window.customAlert("حدث خطأ: " + e.message);
  }
};
/* =========================================
 17. Add New Relative Functionality
 ========================================= */
window.addNewRelative = async () => {
  const focusId = document.getElementById("modal-id-display").innerText;
  const focusPerson = window.currentMembers.find((m) => m.id === focusId);

  const newName = document.getElementById("new-name").value;
  const newGender = document.getElementById("new-gender").value;
  const relation = document.getElementById("relation-type").value;
  const existingMemberId = document.getElementById("new-existing-member").value;

  const newImg =
    document.getElementById("new-img").value ||
    (newGender === "male" ? "mainmale.png" : "mainfemale.png");
  const isDeceased = document.getElementById("new-is-deceased").checked;
  const deathDate = document.getElementById("new-death-date").value;
  const dob = document.getElementById("new-dob").value;
  const hideMain = document.getElementById("new-hide-main").checked;

  // التحقق من الشجرة الحالية
  if (!window.currentTreeId)
    return window.customAlert("خطأ: لم يتم التعرف على الشجرة الحالية");

  if (!newName && !existingMemberId)
    return window.customAlert("الرجاء إدخال الاسم أو اختيار شخص موجود!");

  // ... (نفس كود التحقق من الزواج والقرابة الموجود سابقاً) ...
  if (relation === "spouse") {
    if (focusPerson.spouse)
      return window.customAlert("عفواً.. هذا الشخص متزوج بالفعل ⛔");
    if (focusPerson.fiance)
      return window.customAlert("عفواً.. هذا الشخص مرتبط بخطوبة سارية! 💍⛔");
    if (!existingMemberId && focusPerson.gender === newGender)
      return window.customAlert("عفواً.. لا يمكن زواج نفس الجنس ⛔");
  }

  try {
    let newDocId = existingMemberId;

    // تحديد المسار الصحيح للكولكشن (داخل الشجرة)
    const membersCollectionRef = collection(
      db,
      "trees",
      window.currentTreeId,
      "members"
    );

    // لو شخص جديد (Create)
    if (!existingMemberId) {
      const docRef = await addDoc(membersCollectionRef, {
        name: newName,
        gender: newGender,
        img: newImg,
        dob: dob,
        isDeceased: isDeceased,
        deathDate: isDeceased ? deathDate : null,
        isPrivate: hideMain,
        level: focusPerson.level,
        socialLinks: [],
        createdAt: new Date().toISOString(),
      });
      newDocId = docRef.id;
    }

    const updatesFocus = {};
    const updatesNew = {};

    if (relation === "parent") {
      updatesNew.level = focusPerson.level - 1;
      updatesFocus.parent = newDocId;
    } else if (relation === "child") {
      updatesNew.level = focusPerson.level + 1;
      updatesNew.parent = focusId;
    } else if (relation === "spouse") {
      updatesNew.level = focusPerson.level;
      updatesFocus.spouse = newDocId;
      updatesNew.spouse = focusId;
      updatesFocus.fiance = null;
      updatesFocus.engagementDate = null;
      updatesNew.fiance = null;
      updatesNew.engagementDate = null;
    } else if (relation === "sibling") {
      updatesNew.level = focusPerson.level;
      updatesNew.parent = focusPerson.parent;
    }

    // التحديث باستخدام المسار الصحيح
    await updateDoc(
      doc(db, "trees", window.currentTreeId, "members", focusId),
      updatesFocus
    );
    await updateDoc(
      doc(db, "trees", window.currentTreeId, "members", newDocId),
      updatesNew
    );

    window.customAlert("تمت الإضافة بنجاح ✅");
    window.toggleAddSection(false);
    window.openBio(focusId);
  } catch (e) {
    console.error(e);
    window.customAlert("خطأ: " + e.message);
  }
};
/* =========================================
 18. Disable New Member Fields When Linking Existing Member
 ========================================= */
document
  .getElementById("new-existing-member")
  .addEventListener("change", function () {
    const isLinked = this.value !== ""; // هل تم اختيار شخص؟

    // تحديد الخانات التي يجب قفلها
    const fieldsToToggle = ["new-name", "new-age", "new-img", "new-gender"];

    fieldsToToggle.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.disabled = isLinked; // تعطيل الخانة
        el.style.opacity = isLinked ? "0.5" : "1"; // تغيير المظهر ليدل على القفل
        if (isLinked) el.value = ""; // مسح القيمة لمنع التداخل
      }
    });

    if (isLinked) {
      window.customAlert(
        "تم اختيار وضع 'الربط'.. برجاء تحديد نوع العلاقة فقط 🔗"
      );
    }
  });
/* =========================================
 19. Create Member Card with Status Indicators
 ========================================= */
function createCardIn(div, m, label, cls = "") {
  const card = document.createElement("div");

  // كلاسات الجنس والحجم
  const genderClass = m.gender === "female" ? "female-card" : "male-card";
  const sizeClass = m.level > 2 ? "card-small" : "";
  let finalClasses = `member-card ${genderClass} ${cls} ${sizeClass}`;

  // --- 1. الوفاة (أولوية قصوى) ---
  if (m.isDeceased) {
    const status = getDeceasedStatus(m.deathDate);
    const deceasedClass = status === "normal" ? "is-deceased" : status;
    finalClasses += ` ${deceasedClass}`;
    if (deceasedClass === "active-mourning") {
      card.setAttribute(
        "data-mourning-label",
        getMourningLabelText(m.deathDate)
      );
    }
  }
  // --- 2. الأحياء (المناسبات السعيدة) ---
  else {
    // فحص المناسبات (زواج / خطوبة)
    const occasion = analyzeOccasionStatus(m);

    if (occasion) {
      finalClasses += ` ${occasion.className}`;
      // لو فيه عداد تنازلي أو تنبيه لليوم
      if (occasion.label) {
        card.setAttribute("data-occasion-label", occasion.label);
      }
    }
    // فحص عيد الميلاد (فقط لو مفيش مناسبة زواج تغطي عليه)
    else if (isBirthdayToday(m.dob)) {
      finalClasses += " is-birthday";
      setTimeout(() => {
        if (document.body.contains(card)) triggerCardConfetti(card);
      }, 800);
    }
  }

  card.className = finalClasses;
  card.id = m.id;
  card.onclick = () => window.openBio(m.id);
  card.innerHTML = `<img src="${m.img}"><div class="info"><h3>${m.name}</h3><span>${label}</span></div>`;

  div.appendChild(card);
}
/* =========================================
 20. Draw Lines between Members with Performance Optimization
 ========================================= */
function drawLines(members) {
  const svg = document.getElementById("tree-svg");
  if (!svg) return;

  // استخدام requestAnimationFrame لضمان الرسم في الوقت المناسب
  requestAnimationFrame(() => {
    // 1. تنظيف القديم (تفريغ النص أسرع من الحذف عنصر عنصر)
    svg.innerHTML = "";

    // إعادة إضافة الـ Defs (التدرج اللوني) لأننا مسحناه
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = `
      <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color: var(--primary-glow); stop-opacity: 1" />
        <stop offset="100%" style="stop-color: var(--secondary-glow); stop-opacity: 1" />
      </linearGradient>`;
    svg.appendChild(defs);

    const svgR = svg.getBoundingClientRect();
    const positions = new Map(); // خريطة لتخزين الإحداثيات
    const fragment = document.createDocumentFragment(); // تجميع العناصر في الذاكرة

    // 2. مرحلة القراءة (Batch Read): تجميع أماكن كل الكروت الظاهرة فقط
    // هذا يمنع إعادة حساب التخطيط في كل لفة
    members.forEach((m) => {
      const el = document.getElementById(m.id);
      if (el) {
        // نتأكد إن العنصر موجود في الصفحة
        const r = el.getBoundingClientRect();
        positions.set(m.id, {
          x: r.left + r.width / 2 - svgR.left,
          y: r.top - svgR.top, // النقطة العليا
          bottomY: r.bottom - svgR.top, // النقطة السفلى
          width: r.width,
          height: r.height,
        });
      }
    });

    // 3. مرحلة الكتابة (Batch Write): الحساب والرسم بدون قراءة الـ DOM
    members.forEach((m) => {
      const childPos = positions.get(m.id);
      if (!childPos) return;

      // أ) رسم خط الأبناء (Curved Lines)
      if (m.parent) {
        const parentPos = positions.get(m.parent);
        const parentObj = members.find((x) => x.id === m.parent);

        // التأكد من الرسم فقط إذا كان الأب "ذكر" وموجود
        if (parentPos && parentObj && parentObj.gender === "male") {
          const path = createSVGPath(
            parentPos.x,
            parentPos.bottomY,
            childPos.x,
            childPos.y,
            false
          );
          fragment.appendChild(path);
        }
      }

      // ب) رسم خط الزواج (Dashed Curve) - فقط في المنظور الشخصي
      if (viewMode === "perspective" && m.spouse) {
        const spousePos = positions.get(m.spouse);
        // شرط m.id < m.spouse عشان نرسم الخط مرة واحدة بس مش مرتين
        if (spousePos && m.id < m.spouse) {
          const path = createSpousePath(childPos, spousePos);
          fragment.appendChild(path);
        }
      }
    });

    // 4. إضافة كل الخطوط للـ SVG دفعة واحدة
    svg.appendChild(fragment);
  });
}
/* =========================================
 21. Create SVG Path Functions
 ========================================= */
function createSVGPath(x1, y1, x2, y2) {
  const midY = (y1 + y2) / 2;
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`
  );
  path.setAttribute("stroke", "var(--text-main)");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke-width", "3");

  // [تعديل]: إضافة كلاس الرسم
  path.classList.add("drawing-line");

  return path;
}
/* =========================================
 22. Create Spouse Path Function
 ========================================= */
function createSpousePath(pos1, pos2) {
  const x1 = pos1.x;
  const y1 = pos1.y + pos1.height / 2;
  const x2 = pos2.x;
  const y2 = pos2.y + pos2.height / 2;

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  const midX = (x1 + x2) / 2;
  const controlY = Math.min(y1, y2) - 50;

  path.setAttribute("d", `M ${x1} ${y1} Q ${midX} ${controlY} ${x2} ${y2}`);
  path.setAttribute("stroke", "var(--text-main)");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke-width", "2.5");
  path.setAttribute("stroke-dasharray", "10,5");

  // [تعديل]: إضافة كلاس الظهور (بدلاً من الرسم للحفاظ على التقطيع)
  path.classList.add("fading-line");

  return path;
}
/* =========================================
 23. Fit Tree to Screen Function
 ========================================= */
function fitTreeToScreen() {
  const cont = document.getElementById("tree-container");
  const scrW = window.innerWidth * 0.95;
  const treeW = cont.scrollWidth;
  if (treeW > scrW) {
    const scale = scrW / treeW;
    cont.style.transform = `scale(${scale})`;
    cont.style.transformOrigin = "top center";
  } else {
    cont.style.transform = "scale(1)";
  }
}
/* =========================================
 24. Open Bio Modal with Occasion Effects
 ========================================= */
window.openBio = (id) => {
  const m = window.currentMembers.find((x) => x.id === id);
  if (!m) return;

  // إخفاء الأقسام الأخرى
  window.toggleAddSection(false);
  window.toggleEditSection(false);
  document.getElementById("occasions-manager-section").style.display = "none";
  const modalContent = document.querySelector("#bio-modal .modal-content");

  // 1. تنظيف الكلاسات والسمات القديمة
  modalContent.classList.remove(
    "birthday-mode",
    "mourning-mode",
    "deceased-mode",
    "wedding-today-mode", // جديد
    "engagement-today-mode", // جديد
    "anniversary-today-mode"
  );
  modalContent.removeAttribute("data-mourning-label");
  modalContent.removeAttribute("data-occasion-label");

  // إيقاف أي طراقيع سابقة (أمان)
  if (confettiInterval) clearInterval(confettiInterval);

  // 2. تطبيق التأثيرات
  // أ) حالة الوفاة
  if (m.isDeceased) {
    const status = getDeceasedStatus(m.deathDate);
    if (status === "active-mourning") {
      modalContent.classList.add("mourning-mode");
      // نقل نص الحداد من الكارت للمودال
      const card = document.getElementById(id);
      if (card && card.getAttribute("data-mourning-label")) {
        modalContent.setAttribute(
          "data-mourning-label",
          card.getAttribute("data-mourning-label")
        );
      } else {
        // حساب احتياطي لو الكارت مش موجود
        const label = getMourningLabelText(m.deathDate);
        modalContent.setAttribute("data-mourning-label", label);
      }
    } else {
      modalContent.classList.add("deceased-mode");
    }
  } else {
    // نفحص حالة المناسبة
    const occasion = analyzeOccasionStatus(m);

    if (occasion) {
      // 1. يوم الفرح
      if (occasion.className === "wedding-today") {
        modalContent.classList.add("wedding-today-mode");
        triggerCardConfetti(modalContent); // احتفال طراقيع كمان!
      }
      // 2. يوم الخطوبة
      else if (occasion.className === "engagement-today") {
        modalContent.classList.add("engagement-today-mode");
        triggerCardConfetti(modalContent);
      }
      // 3. عيد الزواج السنوي
      else if (occasion.className === "anniversary-today") {
        modalContent.classList.add("anniversary-today-mode");
        // تمرير النص للبوكس الأسود
        if (occasion.label) {
          modalContent.setAttribute("data-occasion-label", occasion.label);
        }
        triggerCardConfetti(modalContent);
      }
      // (يمكنك إضافة حالات "wedding-soon" لو عايز برواز انتظار للمودال أيضاً)
    }

    // ج) عيد الميلاد (لو مفيش مناسبة زواج تغطي عليه)
    else if (isBirthdayToday(m.dob)) {
      modalContent.classList.add("birthday-mode");
      triggerCardConfetti(modalContent);
      confettiInterval = setInterval(() => {
        if (document.getElementById("bio-modal").style.display !== "none") {
          triggerCardConfetti(modalContent);
        } else {
          clearInterval(confettiInterval);
        }
      }, 2000);
    }
  }
  document.getElementById("modal-name").innerText = m.name;
  document.getElementById("modal-id-display").innerText = id;
  document.getElementById("modal-img").src = m.img;

  const parent = window.currentMembers.find((p) => p.id === m.parent);
  const parentName = parent ? `(${parent.name})` : "";

  // نضع الاسم وبجانبه اسم الأب (داخل span لتصغيره قليلاً)
  document.getElementById("modal-name").innerHTML = `
    ${m.name} 
    <span class="father-name-tag">${parentName}</span>
  `;

  // 3. [تعديل] إخفاء ديف الأب القديم (لأنه خلاص بقا جنب الاسم)
  const fatherDiv = document.getElementById("modal-father");
  if (fatherDiv) fatherDiv.style.display = "none";

  // حساب العمر والبيانات التحليلية
  let displayAge = "";
  const badgesContainer = document.getElementById("extra-info-badges");
  badgesContainer.innerHTML = ""; // تفريغ الأوسمة القديمة

  if (m.dob) {
    const ageVal = calculateAgeFromDOB(m.dob);
    displayAge = calculateAgeFromDOB(m.dob);
    // استخراج التاريخ
    const dateObj = new Date(m.dob);
    const day = dateObj.getDate();
    const month = dateObj.getMonth() + 1;
    const year = dateObj.getFullYear();

    // 1. إضافة وسام البرج
    const zodiac = getZodiac(day, month);
    badgesContainer.innerHTML += `
      <div class="info-badge badge-zodiac" title="البرج الفلكي">
        <i>${zodiac.char}</i> ${zodiac.name}
      </div>
    `;

    // 2. إضافة وسام الجيل
    const gen = getGeneration(year);
    badgesContainer.innerHTML += `
      <div class="info-badge badge-gen" title="الجيل">
        <i>🧬</i> ${gen}
      </div>
    `;

    // 3. إضافة وسام عيد الميلاد (فقط للأحياء)
    // (يمكنك إضافة شرط هنا لو عندك حقل "تاريخ وفاة")
    if (m.isDeceased && m.deathDate) {
      // --- حالة الوفاة: عرض المدة منذ الوفاة ---
      const timeSince = calculateTimeSince(m.deathDate);
      badgesContainer.innerHTML += `
         <div class="info-badge" style="border-color: #94a3b8; color: #94a3b8;" title="تاريخ الوفاة: ${m.deathDate}">
           <i>🕊️</i> متوفي منذ ${timeSince}
         </div>
       `;
    } else {
      // --- حالة الحياة: عرض العد التنازلي لعيد الميلاد ---
      const countdown = getNextBirthdayCountdown(m.dob);
      badgesContainer.innerHTML += `
         <div class="info-badge badge-bday" title="عيد الميلاد القادم">
           <i>⏳</i> ${countdown}
         </div>
       `;
    }
  } else if (m.age) {
    displayAge = `${m.age} سنة`; // دعم البيانات القديمة
  }

  document.getElementById("modal-age").innerText = displayAge;

  // 2. تعبئة خانات التعديل (Edit Form) بالبيانات الحالية
  document.getElementById("edit-name").value = m.name || "";
  document.getElementById("edit-img").value = m.img || "";
  document.getElementById("edit-dob").value = m.dob || ""; // نضع تاريخ الميلاد
  const isDead = m.isDeceased || false;
  document.getElementById("edit-is-deceased").checked = isDead;
  document.getElementById("edit-death-date").value = m.deathDate || "";

  if (isDead) {
    // لو متوفي: نخفي زرار التسجيل ونظهر التاريخ
    document.getElementById("edit-mark-deceased-btn").style.display = "none";
    document.getElementById("edit-death-date-wrapper").style.display = "flex";
  } else {
    // لو عايش: نظهر زرار التسجيل ونخفي التاريخ
    document.getElementById("edit-mark-deceased-btn").style.display = "block";
    document.getElementById("edit-death-date-wrapper").style.display = "none";
  }

  // [مهم]: تم حذف السطر القديم الخاص بـ edit-age لأنه كان يسبب العطل

  // 3. جلب السوشيال ميديا للتعديل والعرض
  const editSocialContainer = document.getElementById("edit-social-list");
  editSocialContainer.innerHTML = "";
  const platforms = ["wa", "fb", "inst", "tt", "tg", "phone"];
  platforms.forEach((p) => {
    if (m[p]) {
      window.addSocialRow("edit", p, m[p]);
    }
  });

  const menu = document.querySelector(".social-menu");
  menu.innerHTML = "";
  if (m.fb) menu.innerHTML += `<a href="${m.fb}" target="_blank">Facebook</a>`;
  if (m.wa)
    menu.innerHTML += `<a href="https://wa.me/${m.wa}" target="_blank">WhatsApp</a>`;

  // === 🛡️ نظام الصلاحيات والأمان والتحكم في الأزرار 🛡️ ===

  // 1. إعادة الوضع للافتراضي (غلق وضع التعديل)
  document.body.classList.remove("admin-mode");

  // 2. تعريف الصلاحيات
  const myLinkedId = window.currentUserLinkedMemberId;
  const isAdmin = window.treeCreatorId === currentUser.uid; // هل أنا الأدمن؟
  const isMyProfile = myLinkedId === id; // هل ده بروفايلي؟
  const isAvailable = !m.linkedUserId; // هل متاح للربط؟
  const amIGuest = !myLinkedId; // هل أنا زائر؟

  // 3. التحكم في زر "الترس" (edit mode toggle)
  const toggleBtn = document.querySelector(".btn-mini-mode");
  if (toggleBtn) {
    // يظهر فقط للأدمن أو صاحب البروفايل
    toggleBtn.style.display = isAdmin || isMyProfile ? "flex" : "none";
  }

  // 4. التحكم في أزرار "عرض الملف، مناسبة، تواصل، مشاركة"
  const viewButtons = document.querySelectorAll(".view-controls .action-item");

  // زر "عرض الملف" هو الأول دايماً (Index 0)
  // باقي الأزرار (مناسبة، تواصل، مشاركة) هي (Index 1, 2, 3)

  viewButtons.forEach((btn, index) => {
    if (isAdmin || isMyProfile) {
      // لو أنا صاحب الحق، أظهر كل الأزرار
      btn.style.display = "flex";
      // ولو الزرار موجود جوه dropdown (زي التواصل) نظهر الأب بتاعه
      if (btn.closest(".social-dropdown"))
        btn.closest(".social-dropdown").style.display = "inline-block";
    } else {
      // لو أنا زائر
      if (index === 0) {
        // خلي زرار "عرض الملف" بس
        btn.style.display = "flex";
      } else {
        // أخفي الباقي (مناسبة، تواصل، مشاركة)
        btn.style.display = "none";
        // إخفاء حاوية التواصل بالكامل لو موجودة
        if (btn.closest(".social-dropdown"))
          btn.closest(".social-dropdown").style.display = "none";
      }
    }
  });

  // 5. زر "هذا أنا" (يظهر للزائر فقط على بروفايل متاح)
  const oldClaimBtn = document.getElementById("claim-btn-dynamic");
  if (oldClaimBtn) oldClaimBtn.remove();

  // الشرط: (أنا زائر) && (البروفايل ليس له صاحب linkedUserId)
  if (amIGuest && !m.linkedUserId) {
    const claimBtn = document.createElement("button");
    claimBtn.id = "claim-btn-dynamic";
    claimBtn.innerText = "🙋‍♂️ هذا أنا";
    claimBtn.className = "btn-primary";
    claimBtn.style =
      "width:100%; margin-top:10px; background:#10b981; padding: 8px;";
    claimBtn.onclick = () => window.claimProfile(id);

    const headerDiv = document.querySelector(".profile-header");
    if (headerDiv) headerDiv.appendChild(claimBtn);
  } else if (m.linkedUserId && amIGuest) {
    // (اختياري) يمكنك إظهار علامة أن هذا الحساب موثق
    // مثلاً: badge بجانب الاسم
  }

  // فتح المودال
  document.getElementById("bio-modal").style.display = "flex";
  document.getElementById("modal-name").setAttribute("data-current-id", id);
};
/* =========================================
 25. Close Bio Modal Function
 ========================================= */
window.closeBio = () => {
  // إيقاف تكرار الطراقيع فوراً
  if (confettiInterval) {
    clearInterval(confettiInterval);
    confettiInterval = null;
  }
  document.body.classList.remove("admin-mode");
  closeModalSmoothly("bio-modal");
};
document.getElementById("bio-modal").style.display = "none";

/* =========================================
 26. Switch Profile and Show Full Tree Functions
 ========================================= */
window.switchProfile = () => {
  const id = document.getElementById("modal-id-display").innerText;
  if (!id) return;

  // هنا بنبعت الـ id كباراميتر تاني عشان الدالة تعرف هتعمل زوم فين
  animateTransition(() => {
    if (currentFocusId && currentFocusId !== id) {
      navHistory.push(currentFocusId);
    }

    window.closeBio();
    currentFocusId = id;
    viewMode = "perspective";
    refreshUI();
  }, id); // <--- لاحظ تمرير الـ id هنا
};
window.showFullTree = () => {
  // نمرر currentFocusId عشان الأنيميشن يعرف إحنا راجعين منين
  animateTransition(() => {
    viewMode = "full";
    refreshUI();
  }, currentFocusId);
};
/* =========================================
 27. Delete Member Functionality
 ========================================= */
window.deleteMember = () => {
  const id = document.getElementById("modal-id-display").innerText;
  const m = window.currentMembers.find((x) => x.id === id);

  // هل هذا البروفايل مربوط بمستخدم؟
  const isLinked = m.linkedUserId != null;
  // هل هذا البروفايل يخصني أنا؟
  const isMe = m.linkedUserId === auth.currentUser.uid;
  // هل أنا الأدمن؟ (نستخدم المتغيرات العالمية اللي عرفناها)
  const isAdmin = window.isTreeOwner || window.canDelete;

  // السيناريوهات:
  // 1. أنا صاحب البروفايل -> فك ربط (خروج)
  // 2. أنا أدمن والبروفايل مربوط -> فك ربط (طرد المستخدم وإبقاء الشخصية)
  // 3. أنا أدمن والبروفايل مش مربوط -> حذف نهائي

  if (isMe || (isAdmin && isLinked)) {
    // سيناريو فك الربط
    const confirmMsg = isMe
      ? "هل أنت متأكد من فك الربط والخروج من هذا البروفايل؟\n(لن يتم حذف الشخصية من الشجرة، لكن ستفقد السيطرة عليها)."
      : "⚠️ هذا البروفايل مرتبط بمستخدم حقيقي.\nهل تريد فك ربط المستخدم وإبقاء الشخصية في الشجرة؟";

    if (confirm(confirmMsg)) {
      window.unlinkMember(id, m.linkedUserId);
    }
  } else if (isAdmin && !isLinked) {
    // سيناريو الحذف النهائي (لأنه مش مربوط)
    const overlay = document.getElementById("custom-confirm-overlay");
    overlay.style.display = "flex";

    document.getElementById("confirm-yes").onclick = async () => {
      if (!window.currentTreeId) return;
      try {
        await deleteDoc(doc(db, "trees", window.currentTreeId, "members", id));
        window.closeCustomConfirm();
        window.closeBio();
        window.customAlert("تم الحذف من الشجرة نهائياً 🗑️");
      } catch (e) {
        window.customAlert("خطأ: " + e.message);
      }
    };
  } else {
    window.customAlert("⛔ ليس لديك صلاحية حذف هذا العضو.");
  }
};
/* =========================================
 28. Unlink Member Functionality
 ========================================= */
window.unlinkMember = async (memberId, targetUid) => {
  try {
    // 1. تحديث البروفايل في الشجرة (إزالة linkedUserId)
    await updateDoc(
      doc(db, "trees", window.currentTreeId, "members", memberId),
      {
        linkedUserId: null,
      }
    );

    // 2. تحديث بيانات المستخدم في كولكشن users (إزالة linkedTreeId)
    if (targetUid) {
      await updateDoc(doc(db, "users", targetUid), {
        linkedTreeId: null,
        linkedMemberId: null,
      });
    }

    window.customAlert("✅ تم فك الربط بنجاح.");

    // لو أنا اللي خرجت نفسي، لازم أعمل ريلود عشان أخرج بره الشجرة
    if (targetUid === auth.currentUser.uid) {
      window.location.href = "index.html";
    } else {
      window.openBio(memberId); // تحديث المودال للأدمن
    }
  } catch (e) {
    console.error(e);
    window.customAlert("حدث خطأ أثناء فك الربط: " + e.message);
  }
};

window.closeCustomConfirm = () => closeModalSmoothly("custom-confirm-overlay");
/* =========================================
 29. Render Empty State Function
 ========================================= */
window.renderEmptyState = () => {
  document.getElementById(
    "tree-container"
  ).innerHTML = `<div class="empty-state"><button class="btn-start" onclick="window.openAddFirstMember()">➕ ابدأ بإضافة أول فرد</button></div>`;
};
/* =========================================
 30. Open Add First Member Modal Function
 ========================================= */
window.openAddFirstMember = () => {
  document.getElementById("modal-id-display").innerText = "";
  document.getElementById("target-parent-name").innerText = "البداية";
  window.toggleAddSection(true);
  document.getElementById("bio-modal").style.display = "flex";
};
let rTime;
window.addEventListener("resize", () => {
  document.getElementById("tree-svg").innerHTML = "";
  clearTimeout(rTime);
  rTime = setTimeout(() => refreshUI(), 250);
});
/* =========================================
 31. Theme Toggle Functionality
 ========================================= */
window.toggleTheme = () => {
  const html = document.documentElement;
  const current = html.getAttribute("data-theme");
  const next = current === "light" ? "dark" : "light";
  html.setAttribute("data-theme", next);
  localStorage.setItem("theme", next); // لحفظ اختيارك
};
document.documentElement.setAttribute(
  "data-theme",
  localStorage.getItem("theme") || "light"
);
const originalToggleTheme = window.toggleTheme;
window.toggleTheme = () => {
  originalToggleTheme(); // نفذ الدالة القديمة
  updateThemeIconInGrid();
};

function updateThemeIconInGrid() {
  const theme = document.documentElement.getAttribute("data-theme");
  const moon = document.querySelector(".theme-moon");
  const sun = document.querySelector(".theme-sun");

  if (theme === "dark") {
    moon.style.display = "none";
    sun.style.display = "block";
  } else {
    moon.style.display = "block";
    sun.style.display = "none";
  }
}
/* =========================================
 32. Share Member Functionality
 ========================================= */
window.shareMember = () => {
  const id = document.getElementById("modal-id-display").innerText;
  const m = window.currentMembers.find((x) => x.id === id);
  // إنشاء الرابط مع الـ ID الخاص بالفرد
  const shareUrl = `${window.location.origin}${window.location.pathname}?id=${id}`;

  if (navigator.share) {
    // ميزة المشاركة الأصلية في الموبايل
    navigator
      .share({
        title: `ملف عيله- ${m.name}`,
        text: `شاهد الملف الشخصي لـ ${m.name} في شجرة العائلة`,
        url: shareUrl,
      })
      .catch(console.error);
  } else {
    // نسخ الرابط للكلبورد في حال كان المتصفح لا يدعم المشاركة (مثل الكمبيوتر)
    navigator.clipboard.writeText(shareUrl);
    window.customAlert("تم نسخ رابط الملف الشخصي لـ " + m.name + " 🔗");
  }
};
/* =========================================
 33. Link Existing Member in Add Section Functionality
 ========================================= */
window.toggleAddSection = (s) => {
  // 1. تجهيز القائمة المنسدلة إذا كنا سنفتح القسم

  if (s) {
    document.getElementById("new-mark-deceased-btn").style.display = "block";
    document.getElementById("new-death-date-wrapper").style.display = "none";
    document.getElementById("new-is-deceased").checked = false;
    document.getElementById("new-death-date").value = "";
    const select = document.getElementById("new-existing-member");
    const focusId = document.getElementById("modal-id-display").innerText;
    select.innerHTML =
      '<option value="">-- أو اختر شخص موجود للربط --</option>';

    if (window.currentMembers) {
      window.currentMembers.forEach((m) => {
        if (m.id !== focusId) {
          const opt = document.createElement("option");
          opt.value = m.id;
          opt.text = m.name;
          select.add(opt);
        }
      });
    }
  }

  // 2. التحكم في العرض والإخفاء
  document.getElementById("add-section").style.display = s ? "block" : "none";
  document.getElementById("view-section").style.display = s ? "none" : "block";
};
/* =========================================
 34. Enable Deceased Mode Functionality
 ========================================= */
window.enableDeceasedMode = (type) => {
  // 1. إخفاء زرار "تسجيل الوفاة"
  document.getElementById(`${type}-mark-deceased-btn`).style.display = "none";

  // 2. تعليم الخانة المخفية (عشان الحفظ يشتغل صح)
  document.getElementById(`${type}-is-deceased`).checked = true;

  // 3. إظهار خانة التاريخ
  const wrapper = document.getElementById(`${type}-death-date-wrapper`);
  wrapper.style.display = "flex";
  wrapper.style.animation = "fadeIn 0.5s"; // حركة ظهور ناعمة

  // 4. تفعيل التاريخ (Flatpickr)
  if (typeof flatpickr !== "undefined") {
    flatpickr(`#${type}-death-date`, {
      dateFormat: "Y-m-d",
      locale: { firstDayOfWeek: 6 },
    });
  }
};
/* =========================================
 35. Toggle Social Inputs Functionality
 ========================================= */
window.toggleSocialInputs = (type) => {
  const div = document.getElementById(`${type}-social-inputs`);
  div.style.display = div.style.display === "flex" ? "none" : "flex";
};
/* =========================================
 36. Add Social Media Row Functionality
 ========================================= */
window.addSocialRow = (type, platform = "", value = "") => {
  const container = document.getElementById(`${type}-social-list`);
  const row = document.createElement("div");
  row.className = "social-input-row";
  row.innerHTML = `
    <select class="social-type">
      <option value="wa" ${platform === "wa" ? "selected" : ""}>واتساب</option>
      <option value="fb" ${platform === "fb" ? "selected" : ""}>فيسبوك</option>
      <option value="inst" ${
        platform === "inst" ? "selected" : ""
      }>إنستجرام</option>
      <option value="tt" ${platform === "tt" ? "selected" : ""}>تيك توك</option>
      <option value="tg" ${platform === "tg" ? "selected" : ""}>تليجرام</option>
      <option value="phone" ${
        platform === "phone" ? "selected" : ""
      }>رقم هاتف</option>
    </select>
    <input type="text" class="social-value" placeholder="الرابط أو الرقم" value="${value}">
    <button class="btn-remove-row" onclick="this.parentElement.remove()">×</button>
  `;
  container.appendChild(row);
};
/* =========================================
 37. Save Edit Functionality
 ========================================= */
window.saveEdit = async () => {
  const id = document.getElementById("modal-id-display").innerText;
  const m = window.currentMembers.find((x) => x.id === id);

  const name = document.getElementById("edit-name").value;
  const dob = document.getElementById("edit-dob").value;
  const isPrivate = document.getElementById("edit-hide-main").checked;
  const isDeceased = document.getElementById("edit-is-deceased").checked;
  const deathDate = document.getElementById("edit-death-date").value;
  const spouse = document.getElementById("edit-existing-spouse").value;
  let img = document.getElementById("edit-img").value;

  if (!window.currentTreeId) return window.customAlert("خطأ في معرف الشجرة");

  if (!img || img.trim() === "") {
    img = m.gender === "female" ? "mainfemale.png" : "mainmale.png";
  }

  const socialData = { wa: "", fb: "", inst: "", tt: "", tg: "", phone: "" };
  document
    .querySelectorAll("#edit-social-list .social-input-row")
    .forEach((row) => {
      const type = row.querySelector(".social-type").value;
      const val = row.querySelector(".social-value").value;
      if (val) socialData[type] = val;
    });

  if (!name) return window.customAlert("الاسم مطلوب ⚠️");

  try {
    // التصحيح: إضافة المسار الكامل trees -> treeId -> members
    await updateDoc(doc(db, "trees", window.currentTreeId, "members", id), {
      name,
      img,
      dob,
      isPrivate,
      isDeceased,
      deathDate,
      spouse,
      ...socialData,
    });
    window.customAlert("تم التحديث بنجاح! ✨");
    window.toggleEditSection(false);
    window.openBio(id);
  } catch (e) {
    console.error(e);
    window.customAlert("خطأ: " + e.message);
  }
};
/* =========================================
 38. Custom Alert Functionality
 ========================================= */
window.customAlert = (message) => {
  document.getElementById("custom-alert-message").innerText = message;
  document.getElementById("custom-alert-overlay").style.display = "flex";
};
window.closeCustomAlert = () => closeModalSmoothly("custom-alert-overlay");
/* =========================================
 39. Reset Photo Field Functionality
 ========================================= */
window.resetPhotoField = (type) => {
  const inputField = document.getElementById(`${type}-img`);
  const id = document.getElementById("modal-id-display").innerText;
  const m = window.currentMembers.find((x) => x.id === id);

  // تحديد الجنس بناءً على الحالة (تعديل أو إضافة جديد)
  let gender = "male";
  if (type === "edit" && m) {
    gender = m.gender;
  } else if (type === "new") {
    gender = document.getElementById("new-gender").value;
  }

  const defaultImg = gender === "female" ? "mainfemale.png" : "mainmale.png";

  // الخطوة الأهم: تصغير قيمة الحقل وتحديث الصورة فوراً
  if (inputField) {
    inputField.value = ""; // تفريغ النص تماماً
    document.getElementById("modal-img").src = defaultImg; // تغيير المعاينة
    window.customAlert("تم حذف الرابط واستعادة الصورة الافتراضية ✨");
  }
};
/* =========================================
 40. Search for Person in Relationship Calculator
 ========================================= */
window.searchForCalc = (type) => {
  const val = document
    .getElementById(`input-person-${type}`)
    .value.toLowerCase();
  const resDiv = document.getElementById(`results-person-${type}`);
  resDiv.innerHTML = "";

  if (!val) {
    resDiv.style.display = "none";
    return;
  }

  const matches = window.currentMembers.filter((m) =>
    m.name.toLowerCase().includes(val)
  );
  if (matches.length > 0) {
    resDiv.style.display = "block";
    matches.forEach((m) => {
      const parent = window.currentMembers.find((p) => p.id === m.parent);
      const parentName = parent ? `(${parent.name})` : "";

      const item = document.createElement("div");
      item.className = "modal-search-item";
      item.innerHTML = `<img src="${m.img}"> <div><b style="font-size:0.85rem">${m.name}</b> <br> <small style="opacity:0.6">${parentName}</small></div>`;

      item.onclick = () => {
        document.getElementById(`input-person-${type}`).value = m.name;
        document.getElementById(`id-person-${type}`).value = m.id;
        resDiv.style.display = "none";
      };
      resDiv.appendChild(item);
    });
  }
};
/* =========================================
 41. Calculate Relationship Functionality
 ========================================= */
window.swapCalcPersons = () => {
  const aName = document.getElementById("input-person-a").value;
  const aId = document.getElementById("id-person-a").value;
  const bName = document.getElementById("input-person-b").value;
  const bId = document.getElementById("id-person-b").value;

  document.getElementById("input-person-a").value = bName;
  document.getElementById("id-person-a").value = bId;
  document.getElementById("input-person-b").value = aName;
  document.getElementById("id-person-b").value = aId;

  // إعادة الحساب فوراً بعد التبديل لو كان الصندوق مفتوحاً
  if (document.getElementById("rel-result-box").style.display === "block") {
    window.calculateRelationship();
  }
};
window.calculateRelationship = () => {
  const id1 = document.getElementById("id-person-a").value;
  const id2 = document.getElementById("id-person-b").value;
  const members = window.currentMembers;

  if (!id1 || !id2) return window.customAlert("اختار شخصين من البحث ⚠️");
  if (id1 === id2) return window.customAlert("دا نفس الشخص 😂");

  const p1 = members.find((m) => m.id === id1);
  const p2 = members.find((m) => m.id === id2);

  const isTargetFemale = p2.gender === "female";
  const suffix = p1.gender === "female" ? "ها" : "ه";

  // دالة مساعدة لجلب الأم (عن طريق زوجة الأب)
  const getMother = (person) => {
    if (!person || !person.parent) return null;
    const father = members.find((m) => m.id === person.parent);
    if (!father) return null;
    return members.find(
      (m) => m.id === father.spouse || m.spouse === father.id
    );
  };

  const p1Mother = getMother(p1);
  const p2Mother = getMother(p2);
  // دالة مساعدة سريعة: هل الشخصين إخوة؟ (من الأب أو الأم)
  const areSiblings = (personA, personB) => {
    if (!personA || !personB) return false;
    // نفس الأب
    if (personA.parent && personB.parent && personA.parent === personB.parent)
      return true;
    // نفس الأم
    const motherA = getMother(personA);
    const motherB = getMother(personB);
    if (motherA && motherB && motherA.id === motherB.id) return true;
    return false;
  };
  // ---------------------------------------------------------
  // 1. فحص صلة الأمومة/الأبوة المباشرة (الدرجة الأولى)
  // ---------------------------------------------------------
  // هل P2 هو والد/والدة P1؟
  if (p1.parent === id2) {
    showResult("أبو" + suffix);
    return;
  }
  if (p1Mother && p1Mother.id === id2) {
    showResult(isTargetFemale ? "أم" + suffix : "مرات أبو" + suffix);
    return;
  }
  // هل P1 هو والد/والدة P2؟ (العكس)
  if (p2.parent === id1) {
    showResult(isTargetFemale ? "بنت" + suffix : "ابن" + suffix);
    return;
  }
  if (p2Mother && p2Mother.id === id1) {
    showResult(isTargetFemale ? "بنت" + suffix : "ابن" + suffix); // (أو ابن الزوجة)
    return;
  }

  // ---------------------------------------------------------
  // 2. خوارزمية المسارات المتعددة (Multi-Path LCA)
  // ---------------------------------------------------------
  const getPath = (id) => {
    let path = [];
    let curr = members.find((m) => m.id === id);
    while (curr) {
      path.push(curr.id);
      curr = members.find((m) => m.id === curr.parent);
    }
    return path;
  };

  // سنجهز 4 مسارات محتملة (مسار الأب ومسار الأم لكل طرف)
  const path1F = getPath(id1); // مساري عبر أبي
  const path1M = p1Mother ? getPath(p1Mother.id) : []; // مساري عبر أمي

  const path2F = getPath(id2); // مساره عبر أبيه
  const path2M = p2Mother ? getPath(p2Mother.id) : []; // مساره عبر أمه

  // دالة صغيرة للبحث عن التقاطع وحساب المسافة
  const checkIntersection = (pathA, pathB, offsetA, offsetB) => {
    const lcaId = pathA.find((id) => pathB.includes(id));
    if (lcaId) {
      return {
        lca: members.find((m) => m.id === lcaId),
        d1: pathA.indexOf(lcaId) + offsetA,
        d2: pathB.indexOf(lcaId) + offsetB,
        // نحتاج نعرف مسار P2 جه منين عشان نحدد هو (ابن أخ) ولا (ابن أخت)
        targetSide: offsetB === 0 ? "father" : "mother",
        // نحتاج نعرف مسار P1 جه منين عشان نحدد هو (عم) ولا (خال)
        mySide: offsetA === 0 ? "father" : "mother",
      };
    }
    return null;
  };

  // نجرب الاحتمالات الأربعة بالترتيب:
  // 1. أب - أب (أقارب عصب: أعمام، أبناء عم)
  let result = checkIntersection(path1F, path2F, 0, 0);

  // 2. أب - أم (أنا الخال/العمة، هو ابن الأخت/الأخ)
  if (!result) result = checkIntersection(path1F, path2M, 0, 1);

  // 3. أم - أب (أنا ابن الأخت/الأخ، هو الخال/العمة)
  if (!result) result = checkIntersection(path1M, path2F, 1, 0);

  // 4. أم - أم (أقارب رحم: خالات، أبناء خالة)
  if (!result) result = checkIntersection(path1M, path2M, 1, 1);

  // ---------------------------------------------------------
  // 3. تحليل النتائج
  // ---------------------------------------------------------
  if (result) {
    const { d1, d2, mySide, targetSide } = result;
    let rel = "";

    // 1. الإخوة (نفس الأب أو الأم)
    if (d1 === 1 && d2 === 1) {
      rel = isTargetFemale ? "أخت" + suffix : "أخو" + suffix;
    }

    // 2. الآباء والأبناء (تم تغطيتها فوق، بس زيادة تأكيد لو الجد مشترك مباشر)
    else if (d1 === 1 && d2 === 0)
      rel = isTargetFemale ? "أم" + suffix : "أبو" + suffix;
    else if (d1 === 0 && d2 === 1)
      rel = isTargetFemale ? "بنت" + suffix : "ابن" + suffix;
    // 3. الأجداد والأحفاد
    else if (d1 === 2 && d2 === 0)
      rel = isTargetFemale ? "جدة" : "جد"; // + suffix
    else if (d1 === 0 && d2 === 2)
      rel = isTargetFemale ? "حفيدة" : "حفيد"; // + suffix
    // 4. الأعمام والأخوال (d1=2, d2=1)
    // يعني أنا الحفيد (مسافة 2) وهو ابن الجد (مسافة 1)
    else if (d1 === 2 && d2 === 1) {
      // لو أنا جيت عن طريق "أبي" (mySide == father) -> يبقى ده (عم/عمة)
      // لو أنا جيت عن طريق "أمي" (mySide == mother) -> يبقى ده (خال/خالة)
      if (mySide === "father") {
        rel = isTargetFemale ? "عمت" + suffix : "عم" + suffix;
      } else {
        rel = isTargetFemale ? "خالت" + suffix : "خال" + suffix;
      }
    }

    // 5. أبناء الإخوة والأخوات (d1=1, d2=2) - (إصلاح العكس)
    // يعني أنا ابن الجد (مسافة 1) وهو الحفيد (مسافة 2)
    else if (d1 === 1 && d2 === 2) {
      const prefix = isTargetFemale ? "بنت " : "ابن ";
      // هنا بقى بنشوف "هو" (القريب) جه عن طريق مين؟
      // لو جه عن طريق أبوه (targetSide == father) -> يبقى هو ابن أخي
      // لو جه عن طريق أمه (targetSide == mother) -> يبقى هو ابن أختي
      if (targetSide === "father") {
        rel = prefix + "أخو" + suffix; // ابن أخوه
      } else {
        rel = prefix + "أخت" + suffix; // ابن أخته
      }
    }

    // 6. أبناء العم/الخال (d1=2, d2=2)
    else if (d1 === 2 && d2 === 2) {
      const childPrefix = isTargetFemale ? "بنت " : "ابن ";

      if (mySide === "father") {
        // أنا من طرف الأب (أعمام)
        // هو من طرف أبوه (ابن عم) ولا أمه (ابن عمة)؟
        if (targetSide === "father") rel = childPrefix + "عم" + suffix;
        else rel = childPrefix + "عمت" + suffix;
      } else {
        // أنا من طرف الأم (أخوال)
        // هو من طرف أبوه (ابن خال) ولا أمه (ابن خالة)؟
        if (targetSide === "father") rel = childPrefix + "خال" + suffix;
        else rel = childPrefix + "خالت" + suffix;
      }
    }

    // 7. صلات أبعد
    else if (d1 === 3 && d2 === 0) rel = "جد أبوه";
    else if (d1 === 0 && d2 === 3) rel = "ابن حفيده";
    else {
      rel = `قريب من الدرجة (${d1} - ${d2})`;
    }

    showResult(rel);
  } // ---------------------------------------------------------
  // 4. فحص علاقات المصاهرة (New: In-Laws)
  // ---------------------------------------------------------
  else {
    let relFound = false;

    // أ) الزواج المباشر
    if (p1.spouse === id2 || p2.spouse === id1) {
      showResult(isTargetFemale ? "مرات" + suffix : "جوز" + suffix);
      relFound = true;
    }

    // ب) جوز الأخت / مرات الأخ (زوج/زوجة شقيقي)
    if (!relFound && p2.spouse) {
      const spouseObj = members.find((m) => m.id === p2.spouse);
      // هل زوج/زوجة الهدف هو أخي/أختي؟
      if (areSiblings(p1, spouseObj)) {
        if (isTargetFemale) showResult("مرات أخو" + suffix);
        else showResult("جوز أخت" + suffix);
        relFound = true;
      }
    }

    // ج) أخو الزوجة / أخت الزوج (شقيق/شقيقة زوجي)
    if (!relFound && p1.spouse) {
      const spouseObj = members.find((m) => m.id === p1.spouse);
      // هل الهدف هو أخ/أخت زوجي/زوجتي؟
      if (areSiblings(p2, spouseObj)) {
        if (p1.gender === "male") {
          // أنا ذكر (الزوج) -> ده أخو مراتي أو أخت مراتي
          if (isTargetFemale) showResult("أخت مراته");
          else showResult("أخو مراته (نسيبه)");
        } else {
          // أنا أنثى (الزوجة) -> ده أخو جوزي أو أخت جوزي
          if (isTargetFemale) showResult("أخت جوزها (سلفتها)");
          else showResult("أخو جوزها (سلفها)");
        }
        relFound = true;
      }
    }

    if (!relFound) {
      window.customAlert("لا توجد صلة قرابة مباشرة مسجلة 🤷‍♂️");
    }
  }
};

function showResult(text) {
  document.getElementById("rel-result-text").innerText = text;
  document.getElementById("rel-result-box").style.display = "block";
}
window.openRelCalc = () => {
  document.getElementById("rel-calc-modal").style.display = "flex";
  document.getElementById("rel-result-box").style.display = "none";
  document.getElementById("input-person-a").value = "";
  document.getElementById("input-person-b").value = "";
};
function animateTransition(callback, targetId) {
  const container = document.getElementById("tree-container");

  // 1. تحديد نقطة الزوم (Focus Point)
  if (targetId) {
    const targetCard = document.getElementById(targetId);
    if (targetCard) {
      const x = targetCard.offsetLeft + targetCard.offsetWidth / 2;
      const y = targetCard.offsetTop + targetCard.offsetHeight / 2;
      container.style.transformOrigin = `${x}px ${y}px`;
    } else {
      container.style.transformOrigin = "center 30%";
    }
  } else {
    container.style.transformOrigin = "center 30%";
  }

  // 2. بدء أنيميشن الخروج
  container.classList.add("tree-exit");

  setTimeout(() => {
    // 3. تنفيذ التغيير (تغيير البروفايل أو العودة للرئيسية)
    // ملاحظة: callback تستدعي refreshUI، والتي بدورها سترسم الخطوط بعد 800ms
    callback();

    // 4. نقطة الارتكاز للدخول
    container.style.transformOrigin = "center 10%";

    container.classList.remove("tree-exit");
    container.classList.add("tree-enter");

    setTimeout(() => {
      container.classList.remove("tree-enter");

      // إعادة ضبط نقطة الارتكاز
      container.style.transformOrigin = "top center";

      // التأكد من الحجم
      fitTreeToScreen();

      // [تم الحذف]: حذفنا سطر drawLines من هنا لمنع الازدواجية
      // الاعتماد الآن كلياً على refreshUI
    }, 500); // الانتظار حتى انتهاء الحركة تماماً
  }, 350);
}
function closeModalSmoothly(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  const content = modal.querySelector(".modal-content, .custom-alert");

  // 1. إضافة كلاسات الخروج
  modal.classList.add("closing-backdrop");
  if (content) content.classList.add("closing-content");

  // 2. الانتظار حتى ينتهي الأنيميشن ثم الإخفاء الفعلي
  setTimeout(() => {
    modal.style.display = "none";

    // 3. تنظيف الكلاسات عشان لما يفتح تاني يفتح سليم
    modal.classList.remove("closing-backdrop");
    if (content) content.classList.remove("closing-content");
  }, 300); // نفس مدة أنيميشن الـ CSS
}
window.closeRelCalc = () => closeModalSmoothly("rel-calc-modal");
window.closeModalSmoothly = closeModalSmoothly; // عشان الـ HTML يشوفها
/* =========================================
 42. Screen Capture Functionality
 ========================================= */
function loadDomToImage() {
  return new Promise((resolve, reject) => {
    if (window.domtoimage) return resolve();
    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/dom-to-image/2.6.0/dom-to-image.min.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

window.exportTreeImage = async () => {
  window.customAlert("📸 جاري التقاط الصورة بالخطوط... لحظة واحدة");

  try {
    await loadDomToImage();

    const node = document.getElementById("tree-container");
    const wrapper = document.querySelector(".tree-wrapper");

    // حفظ الوضع الحالي
    const originalTransform = node.style.transform;
    const originalOverflow = wrapper.style.overflow;

    // 1. تجهيز الشجرة (فك الزوم عشان الصورة تطلع واضحة)
    node.style.transform = "scale(1)";
    node.style.transformOrigin = "top left";
    node.style.width = node.scrollWidth + "px";
    node.style.height = node.scrollHeight + "px";
    wrapper.style.overflow = "visible"; // إظهار المخفي

    // تأخير بسيط لتطبيق التغييرات
    setTimeout(async () => {
      try {
        // 2. التقاط الصورة بوضع PNG (بيدعم الشفافية والخطوط)
        const dataUrl = await domtoimage.toPng(node, {
          bgcolor:
            document.documentElement.getAttribute("data-theme") === "dark"
              ? "#020604"
              : "#f0fdf4",
          quality: 1,
          style: {
            transform: "scale(1)",
            "transform-origin": "top left",
            width: node.scrollWidth + "px",
            height: node.scrollHeight + "px",
          },
        });

        // 3. التحميل
        const link = document.createElement("a");
        link.download = `family-tree-${new Date().toLocaleDateString()}.png`;
        link.href = dataUrl;
        link.click();

        window.customAlert("تم حفظ الصورة بنجاح! ✅");
      } catch (error) {
        console.error("Export Error:", error);
        window.customAlert("حدث خطأ أثناء حفظ الصورة ❌");
      } finally {
        // 4. إرجاع كل شيء كما كان
        node.style.transform = originalTransform;
        node.style.width = "";
        node.style.height = "";
        node.style.transformOrigin = "top center";
        wrapper.style.overflow = "";
      }
    }, 500);
  } catch (err) {
    console.error(err);
    window.customAlert("تعذر تحميل مكتبة التصوير ❌");
  }
};
/* =========================================
 43. Show Statistics Modal Functionality
 ========================================= */
window.showStatsModal = () => {
  const members = window.currentMembers || [];
  const total = members.length;
  if (total === 0) return window.customAlert("لا توجد بيانات لعرضها!");

  // 1. الحسابات الأساسية
  const males = members.filter((m) => m.gender === "male").length;
  const females = members.filter((m) => m.gender === "female").length;
  const ages = members.map((m) => parseInt(m.age)).filter((a) => !isNaN(a));
  const avgAge = ages.length
    ? Math.floor(ages.reduce((a, b) => a + b, 0) / ages.length)
    : 0;

  // 2. [جديد] حساب أكثر الأسماء تكراراً
  const names = members.map((m) => m.name.split(" ")[0]); // نأخذ الاسم الأول فقط
  const nameCounts = {};
  let mostCommonName = "";
  let maxCount = 0;
  names.forEach((name) => {
    nameCounts[name] = (nameCounts[name] || 0) + 1;
    if (nameCounts[name] > maxCount) {
      maxCount = nameCounts[name];
      mostCommonName = name;
    }
  });

  // 3. [جديد] عميد العائلة وأصغر فرد
  const sortedByAge = members
    .filter((m) => m.age && !isNaN(m.age))
    .sort((a, b) => b.age - a.age);
  const oldest = sortedByAge.length > 0 ? sortedByAge[0] : null;
  const youngest =
    sortedByAge.length > 0 ? sortedByAge[sortedByAge.length - 1] : null;

  // 4. [جديد] متوسط الخصوبة (عدد الأطفال / عدد الآباء)
  const parentsCount = new Set(members.map((m) => m.parent).filter((p) => p))
    .size;
  const fertilityRate = parentsCount
    ? (members.length / parentsCount).toFixed(1)
    : 0;

  // تجهيز HTML
  const statsHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
      
      <div class="stat-card" style="border-color:var(--text-main)">
        <div class="stat-num">${total}</div>
        <div class="stat-label">فرد بالعائلة</div>
      </div>

      <div class="stat-card" style="border-color:var(--secondary-glow)">
        <div class="stat-num" style="font-size:1.2rem">✨ ${
          mostCommonName || "-"
        }</div>
        <div class="stat-label">أكثر اسم (${maxCount})</div>
      </div>

      <div class="stat-card" style="border-color:var(--male-color)">
        <div class="stat-num" style="color:var(--male-color)">${males} 👨</div>
        <div class="stat-label">ذكور (${Math.round(
          (males / total) * 100
        )}%)</div>
      </div>

      <div class="stat-card" style="border-color:var(--female-color)">
        <div class="stat-num" style="color:var(--female-color)">${females} 👩</div>
        <div class="stat-label">إناث (${Math.round(
          (females / total) * 100
        )}%)</div>
      </div>

    </div>

    <div style="background:rgba(0,0,0,0.05); padding:15px; border-radius:15px; display:flex; flex-direction:column; gap:10px;">
        ${
          oldest
            ? `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(0,0,0,0.1); padding-bottom:8px;">
            <span>👴 عميد العائلة:</span>
            <span style="font-weight:bold; color:var(--primary-glow)">${oldest.name} (${oldest.age} سنة)</span>
        </div>`
            : ""
        }
        
        ${
          youngest
            ? `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <span>👶 أصغر العنقود:</span>
            <span style="font-weight:bold; color:var(--secondary-glow)">${youngest.name} (${youngest.age} سنة)</span>
        </div>`
            : ""
        }
    </div>

    <div style="margin-top:15px; font-size:0.8rem; text-align:center; opacity:0.7;">
      متوسط الأعمار: <b>${avgAge}</b> سنة | معدل الذرية: <b>${fertilityRate}</b> طفل/أسرة
    </div>

    <style>
        .stat-card {
            background: rgba(255,255,255,0.05);
            padding: 15px;
            border-radius: 15px;
            border-bottom: 3px solid;
            text-align: center;
        }
        .stat-num { font-size: 1.5rem; font-weight: bold; margin-bottom: 5px; }
        .stat-label { font-size: 0.8rem; opacity: 0.8; }
    </style>
  `;

  // عرض المودال
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.style.display = "flex";
  modal.style.zIndex = "10000"; // فوق كل شيء
  modal.innerHTML = `
    <div class="modal-content glass" style="max-width:380px; animation: contentPopIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
      <span class="close-btn" onclick="this.closest('.modal').remove()">&times;</span>
      <h3 class="modal-title">📊 تحليل بيانات العائلة</h3>
      ${statsHTML}
    </div>
  `;
  document.body.appendChild(modal);
};
/* =========================================
 44. Date of Birth Age Calculation
 ========================================= */
function calculateAgeFromDOB(dobString) {
  if (!dobString) return "";

  const birthDate = new Date(dobString);
  const today = new Date();

  if (isNaN(birthDate.getTime())) return "";

  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  let days = today.getDate() - birthDate.getDate();

  // تصحيح الحسابات في حالة الأيام أو الشهور السالبة
  if (days < 0) {
    months--;
    // الحصول على عدد أيام الشهر السابق بدقة
    days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  // === منطق العرض الذكي ===
  if (years >= 1) {
    return `${years} سنة`;
  } else if (months >= 1) {
    return `${months} شهر`;
  } else {
    // لو الطفل لسه مولود (0 يوم) نكتب "مولود اليوم" أو عدد الأيام
    return days === 0 ? "النهاردة عيد ميلادى 🥳" : `${days} يوم`;
  }
}
document.addEventListener("DOMContentLoaded", () => {
  // التأكد من تحميل المكتبة
  if (typeof flatpickr !== "undefined") {
    const config = {
      dateFormat: "Y-m-d",
      disableMobile: "true", // لإجبار ظهور الستايل المخصص
      locale: {
        firstDayOfWeek: 6, // يبدأ السبت
      },
      // تم حذف theme: "dark" لكي يعمل الـ CSS المخصص بتاعنا
    };
    flatpickr("#new-dob", config);
    flatpickr("#edit-dob", config);
  }
});
/* =========================================
 45. Zodiac Sign and Generation Analysis
 ========================================= */
function getZodiac(day, month) {
  const zodiacs = [
    { char: "♑", name: "الجدي", start: 22 }, // Jan
    { char: "♒", name: "الدلو", start: 20 }, // Feb
    { char: "♓", name: "الحوت", start: 19 }, // Mar
    { char: "♈", name: "الحمل", start: 21 }, // Apr
    { char: "♉", name: "الثور", start: 20 }, // May
    { char: "♊", name: "الجوزاء", start: 21 }, // Jun
    { char: "♋", name: "السرطان", start: 22 }, // Jul
    { char: "♌", name: "الأسد", start: 23 }, // Aug
    { char: "♍", name: "العذراء", start: 23 }, // Sep
    { char: "♎", name: "الميزان", start: 23 }, // Oct
    { char: "♏", name: "العقرب", start: 23 }, // Nov
    { char: "♐", name: "القوس", start: 22 }, // Dec
  ];

  // تصحيح الشهر (لأن المصفوفة تبدأ بـ 0)
  const lastSign = zodiacs[month - 1];
  const nextSign = zodiacs[month % 12]; // لو شهر 12 يرجع لـ 0

  return day < lastSign.start ? zodiacs[(month + 10) % 12] : lastSign;
}
function getGeneration(year) {
  // مواليد 2013 لحد دلوقتي (جيل الآيباد والذكاء الاصطناعي)
  if (year >= 2013) return "براعم المستقبل 🚀";

  // مواليد 1997 - 2012 (الشباب اللي ماسك موبايل طول الوقت)
  if (year >= 1997) return "جيل السوشيال 📱";

  // مواليد 1981 - 1996 (جيل سبيستون وشرايط الكاسيت)
  if (year >= 1981) return "الجيل الذهبي ✨";

  // مواليد 1965 - 1980 (الجيل اللي عاصر التلفزيون الملون والهدوء)
  if (year >= 1965) return "جيل العظماء 📺";

  // مواليد 1946 - 1964 (أهالينا الكبار)
  if (year >= 1946) return "جيل الطيبين 📻";

  // أي حد أكبر من كدا (الأجداد)
  return "روايح الزمن الجميل 📜";
}
/* =========================================
 46.  Birthday Countdown 
 ========================================= */
function getNextBirthdayCountdown(dobString) {
  const today = new Date();
  const dob = new Date(dobString);
  let nextBday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());

  if (today > nextBday) {
    nextBday.setFullYear(today.getFullYear() + 1);
  }

  const diffTime = Math.abs(nextBday - today);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // === المنطق الذكي للعد التنازلي ===

  if (diffDays === 0) {
    return "عيد ميلاده اليوم! 🎂🎉";
  }

  // لو باقي أكثر من 360 يوم (يعني سنة تقريباً)
  else if (diffDays >= 360) {
    return "باقي سنة";
  }

  // لو باقي أكثر من شهر (30 يوم) نحسبها بالشهور
  else if (diffDays >= 30) {
    const months = Math.floor(diffDays / 30);
    return `باقي ${months} شهر`;
  }

  // لو أقل من شهر نحسبها بالأيام
  else {
    return `باقي ${diffDays} يوم`;
  }
}
function isBirthdayToday(dobString) {
  if (!dobString) return false;
  const dob = new Date(dobString);
  const today = new Date();

  // نتأكد أن التاريخ صالح
  if (isNaN(dob.getTime())) return false;

  // نقارن اليوم والشهر فقط (بغض النظر عن السنة)
  return (
    dob.getDate() === today.getDate() && dob.getMonth() === today.getMonth()
  );
}

function triggerCardConfetti(cardElement) {
  if (!cardElement) return;

  const colors = ["#ffd700", "#ff4757", "#2ecc71", "#3498db", "#9b59b6"];

  // زيادة العدد لـ 50 قطعة
  for (let i = 0; i < 50; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.backgroundColor =
      colors[Math.floor(Math.random() * colors.length)];

    cardElement.appendChild(piece);

    // حركة الانفجار في كل الاتجاهات
    const xMove = (Math.random() - 0.5) * 300; // حركة عشوائية يمين ويسار
    const yMove = (Math.random() - 0.5) * 300; // حركة عشوائية فوق وتحت

    const animation = piece.animate(
      [
        { transform: `translate(0, 0) scale(1)`, opacity: 1 },
        { transform: `translate(${xMove}px, ${yMove}px) scale(0)`, opacity: 0 },
      ],
      {
        duration: Math.random() * 1000 + 1500, // من 1.5 لـ 2.5 ثانية
        easing: "cubic-bezier(0.25, 1, 0.5, 1)", // حركة انفجارية سريعة في البداية
      }
    );

    animation.onfinish = () => piece.remove();
  }
}
/* =========================================
 47. Deceased Status Calculation
 ========================================= */
window.toggleDeathDateInput = (type) => {
  const checkbox = document.getElementById(`${type}-is-deceased`);
  const wrapper = document.getElementById(`${type}-death-date-wrapper`);
  if (checkbox.checked) {
    wrapper.style.display = "flex";
    // تفعيل الـ Flatpickr عليها لو مش متفعل
    if (typeof flatpickr !== "undefined") {
      flatpickr(`#${type}-death-date`, {
        dateFormat: "Y-m-d",
        locale: { firstDayOfWeek: 6 },
      });
    }
  } else {
    wrapper.style.display = "none";
    document.getElementById(`${type}-death-date`).value = ""; // مسح التاريخ
  }
};
function getDeceasedStatus(deathDateString) {
  if (!deathDateString) return "normal"; // لو مفيش تاريخ، نرجع للشكل الفضي العادي

  const deathDate = new Date(deathDateString);
  const today = new Date();

  // تصفير الوقت للمقارنة بالأيام فقط
  deathDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffTime = today - deathDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // الحالة 1: أيام الجنازة (أول 3 أيام)
  if (diffDays >= 0 && diffDays <= 3) {
    return "active-mourning";
  }

  // الحالة 2: ذكرى الأربعين (يوم 39 أو 40 أو 41)
  if (diffDays >= 39 && diffDays <= 41) {
    return "active-mourning";
  }

  // الحالة 3: الذكرى السنوية (كل سنة في نفس اليوم والشهر)
  // بنخليها تظهر قبلها بيوم وبعدها بيوم عشان الناس تاخد بالها
  if (diffDays > 360) {
    // لازم يكون عدى سنة على الأقل
    if (
      deathDate.getDate() === today.getDate() &&
      deathDate.getMonth() === today.getMonth()
    ) {
      return "active-mourning";
    }
  }

  // الحالة الافتراضية: متوفى (الشكل الفضي الهادئ)
  return "is-deceased";
}
function getOrdinalYear(num) {
  const ordinals = [
    "",
    "الأولى",
    "الثانية",
    "الثالثة",
    "الرابعة",
    "الخامسة",
    "السادسة",
    "السابعة",
    "الثامنة",
    "التاسعة",
    "العاشرة",
  ];
  if (num <= 10) return ordinals[num];
  return num; // للأرقام الأكبر من 10 يرجع الرقم كما هو (مثلاً: الذكرى 11)
}
function getMourningLabelText(deathDateString) {
  if (!deathDateString) return "";

  const deathDate = new Date(deathDateString);
  const today = new Date();
  deathDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffTime = today - deathDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // أيام العزاء الثلاثة
  if (diffDays === 0) return "اليوم الأول 🏴";
  if (diffDays === 1) return "اليوم الثاني 🏴";
  if (diffDays === 2) return "اليوم الثالث 🏴";

  // الأربعين
  if (diffDays >= 39 && diffDays <= 41) return "ذكرى الأربعين 🏴";

  // الذكرى السنوية
  if (diffDays > 360) {
    const yearDiff = today.getFullYear() - deathDate.getFullYear();
    if (
      deathDate.getDate() === today.getDate() &&
      deathDate.getMonth() === today.getMonth()
    ) {
      return `الذكرى السنوية ${getOrdinalYear(yearDiff)} 🏴`;
    }
  }

  return "حداد 🏴";
}
function calculateTimeSince(dateString) {
  if (!dateString) return "";

  const pastDate = new Date(dateString);
  const today = new Date();

  // حساب الفرق بالمللي ثانية
  const diffTime = Math.abs(today - pastDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // منطق العرض (يوم / شهر / سنة)
  if (diffDays < 30) {
    return `${diffDays} يوم`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} شهر`;
  } else {
    const years = Math.floor(diffDays / 365);
    return `${years} سنة`;
  }
}
/* =========================================
 48. Occasion Modal Functionality
 ========================================= */
window.openOccasionModal = () => {
  // تصفير الخانات
  document.getElementById("occasion-type").selectedIndex = 0;
  document.getElementById("occasion-date").value = "";

  // تنظيف خانة الشريك وفك أي قفل سابق
  const pInput = document.getElementById("occasion-partner-input");
  pInput.value = "";
  pInput.disabled = false;
  pInput.style.opacity = "1";
  pInput.style.color = "var(--text-main)";
  pInput.style.fontWeight = "normal";

  document.getElementById("occasion-partner-id").value = "";
  document.getElementById("occasion-new-partner-name").value = "";

  // إرجاع الراديو للافتراضي (بحث في العائلة)
  const radios = document.getElementsByName("partner-source");
  for (let r of radios) r.checked = r.value === "existing";

  // تحديث الواجهة للإخفاء المبدئي
  window.updateOccasionUI();

  // تفعيل التاريخ
  if (typeof flatpickr !== "undefined") {
    flatpickr("#occasion-date", {
      dateFormat: "Y-m-d",
      locale: { firstDayOfWeek: 6 },
    });
  }

  document.getElementById("occasion-modal").style.display = "flex";
};
window.updateOccasionUI = () => {
  const focusId = document.getElementById("modal-id-display").innerText;
  const focusPerson = window.currentMembers.find((m) => m.id === focusId);
  const typeSelect = document.getElementById("occasion-type");
  const type = typeSelect.value;

  // فحص سريع: هل الشخص ده مرتبط أصلاً؟
  if (type === "engagement" && (focusPerson.spouse || focusPerson.fiance)) {
    window.customAlert("عفواً.. هذا الشخص مرتبط بالفعل! 💍🚫");
    typeSelect.selectedIndex = 0;
    return;
  }
  if (type === "marriage" && focusPerson.spouse) {
    window.customAlert("هذا الشخص متزوج بالفعل! ⛔");
    typeSelect.selectedIndex = 0;
    return;
  }

  // === [هنا السحر: فلترة القائمة] ===
  const partnerSelect = document.getElementById("occasion-partner-id");
  const currentSelection = partnerSelect.value;

  // رسالة افتراضية حسب الجنس
  const defaultText =
    focusPerson.gender === "male" ? "-- اختر العروسة --" : "-- اختر العريس --";
  partnerSelect.innerHTML = `<option value="">${defaultText}</option>`;

  window.currentMembers.forEach((member) => {
    // 1. لا تعرض الشخص نفسه
    if (member.id === focusPerson.id) return;

    // 2. فلتر الجنس والقرابة (باستخدام الدالة اللي فوق)
    // دي هتمنع "بنت وبنت" وهتمنع "أخت وأخوها"
    if (!isMarriageAllowed(focusPerson, member)) return;

    // 3. فلتر الحالة الاجتماعية (ممنوع اختيار حد مرتبط)
    if (member.spouse) return; // لو متجوز مش هيظهر
    if (member.fiance && member.fiance !== focusPerson.id) return; // لو مخطوب لحد تاني مش هيظهر

    // لو عدى من كل ده.. يبقى عريس/عروسة لقطة! نضيفه للقائمة
    const option = document.createElement("option");
    option.value = member.id;
    option.text =
      member.name +
      (member.fiance === focusPerson.id ? " (الخطيب الحالي 💍)" : "");
    partnerSelect.appendChild(option);
  });

  // استعادة الاختيار لو لسه متاح
  if (currentSelection) partnerSelect.value = currentSelection;

  // === [باقي كود الواجهة العادي] ===
  let sourceElement = document.querySelector(
    'input[name="partner-source"]:checked'
  );
  let source = sourceElement ? sourceElement.value : "existing";
  const toggleDiv = document.getElementById("partner-source-toggle");
  const existingWrapper = document.getElementById("partner-select-wrapper");
  const newWrapper = document.getElementById("new-partner-wrapper");
  const partnerInput = document.getElementById("occasion-partner-input");

  partnerInput.disabled = false;
  partnerInput.style.opacity = "1";

  if (!type) {
    toggleDiv.style.display = "none";
    existingWrapper.style.display = "none";
    newWrapper.style.display = "none";
    return;
  }

  // حالة تحويل الخطوبة لزواج (تلقائي)
  if (type === "marriage" && focusPerson.fiance) {
    toggleDiv.style.display = "none";
    source = "existing";
    existingWrapper.style.display = "flex";
    newWrapper.style.display = "none";

    const fiance = window.currentMembers.find(
      (m) => m.id === focusPerson.fiance
    );
    if (fiance) {
      partnerSelect.value = fiance.id;
      partnerSelect.disabled = true;
      partnerInput.value = `${fiance.name} (الخطيب الحالي 💍)`;
      partnerInput.disabled = true;
    }
    return;
  } else {
    partnerSelect.disabled = false;
  }

  toggleDiv.style.display = "flex";
  if (source === "existing") {
    existingWrapper.style.display = "flex";
    newWrapper.style.display = "none";
  } else {
    existingWrapper.style.display = "none";
    newWrapper.style.display = "flex";
  }
};
window.searchForOccasionPartner = () => {
  const val = document
    .getElementById("occasion-partner-input")
    .value.toLowerCase();
  const resDiv = document.getElementById("occasion-partner-results");
  const currentId = document.getElementById("modal-id-display").innerText;

  resDiv.innerHTML = "";
  if (!val) {
    resDiv.style.display = "none";
    return;
  }

  const matches = window.currentMembers.filter(
    (m) => m.name.toLowerCase().includes(val) && m.id !== currentId
  );

  if (matches.length > 0) {
    resDiv.style.display = "block";
    matches.forEach((m) => {
      const item = document.createElement("div");
      item.className = "modal-search-item";
      item.innerHTML = `<img src="${m.img}"> <span>${m.name}</span>`;
      item.onclick = () => {
        document.getElementById("occasion-partner-input").value = m.name;
        document.getElementById("occasion-partner-id").value = m.id;
        resDiv.style.display = "none";
      };
      resDiv.appendChild(item);
    });
  } else {
    resDiv.style.display = "none";
  }
};
window.saveOccasion = async () => {
  // ... (نفس الجزء الأول من الدالة لجلب القيم والتحقق) ...
  const focusId = document.getElementById("modal-id-display").innerText;
  const focusPerson = window.currentMembers.find((m) => m.id === focusId);
  const type = document.getElementById("occasion-type").value;
  const date = document.getElementById("occasion-date").value;
  const source = document.querySelector(
    'input[name="partner-source"]:checked'
  ).value;

  if (!window.currentTreeId) return window.customAlert("خطأ النظام");
  if (!type || !date) return window.customAlert("البيانات ناقصة!");

  let partnerId = null;

  try {
    const membersColl = collection(
      db,
      "trees",
      window.currentTreeId,
      "members"
    );

    if (source === "new") {
      const newName = document.getElementById(
        "occasion-new-partner-name"
      ).value;
      const newGender = focusPerson.gender === "male" ? "female" : "male";
      const defaultImg =
        newGender === "female" ? "mainfemale.png" : "mainmale.png";

      // إضافة الشخص الجديد في المسار الصحيح
      const newDoc = await addDoc(membersColl, {
        name: newName,
        gender: newGender,
        img: defaultImg,
        isPrivate: true,
        level: focusPerson.level,
        createdAt: new Date().toISOString(),
      });
      partnerId = newDoc.id;
    } else {
      partnerId = document.getElementById("occasion-partner-id").value;
      if (!partnerId) return window.customAlert("اختر الشريك");
      // ... (أكواد التحقق من الشريك) ...
    }

    // تحديث البيانات في المسار الصحيح
    const focusDocRef = doc(
      db,
      "trees",
      window.currentTreeId,
      "members",
      focusId
    );
    const partnerDocRef = doc(
      db,
      "trees",
      window.currentTreeId,
      "members",
      partnerId
    );

    if (type === "marriage") {
      await updateDoc(focusDocRef, {
        spouse: partnerId,
        marriageDate: date,
        fiance: null,
        engagementDate: null,
      });
      await updateDoc(partnerDocRef, {
        spouse: focusId,
        marriageDate: date,
        fiance: null,
        engagementDate: null,
      });
      window.customAlert("مبروك الزواج! 💍🎉");
    } else {
      await updateDoc(focusDocRef, { fiance: partnerId, engagementDate: date });
      await updateDoc(partnerDocRef, { fiance: focusId, engagementDate: date });
      window.customAlert("تمت الخطوبة بنجاح 💍✨");
    }

    window.closeModalSmoothly("occasion-modal");
    window.closeBio();
  } catch (e) {
    console.error(e);
    window.customAlert("خطأ: " + e.message);
  }
};
function analyzeOccasionStatus(member) {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // تصفير الوقت

  let status = { className: "", label: null };

  if (member.isDeceased) return null;

  // 1. فحص الزواج (Marriage)
  if (member.marriageDate) {
    const mDate = new Date(member.marriageDate);
    mDate.setHours(0, 0, 0, 0);

    // هل النهاردة نفس "يوم" و "شهر" الفرح؟
    const isAnniversary =
      mDate.getDate() === today.getDate() &&
      mDate.getMonth() === today.getMonth();

    const diffTime = mDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // أ) لو النهاردة ذكرى الزواج
    if (isAnniversary) {
      const years = today.getFullYear() - mDate.getFullYear();

      // سنة 0 = ده يوم الفرح نفسه
      if (years === 0) {
        status.className = "wedding-today";
        status.label = null;
      }
      // أكبر من 0 = ذكرى سنوية
      else if (years > 0) {
        status.className = "anniversary-today";
        status.label = ` عيد جوازي ال(${years})💖`;
      }
    }
    // ب) قبل الفرح بأسبوع (تجهيزات)
    else if (diffDays > 0 && diffDays <= 30) {
      status.className = "wedding-soon";
      status.label =
        diffDays === 1 ? "الليله حنه💃" : `⏳ باقي ${diffDays} يوم ع الفرح`;
    }
    // ج) شهر العسل
    else if (
      diffDays < 0 &&
      diffDays >= -30 &&
      today.getFullYear() === mDate.getFullYear()
    ) {
      status.className = "honeymoon-mode";
    }
    // د) متزوج عادي
    else {
      status.className = "married-mode";
    }

    if (status.className && status.className !== "married-mode") return status;
  }

  // 2. فحص الخطوبة (Engagement)
  if (member.engagementDate && !member.marriageDate) {
    const eDate = new Date(member.engagementDate);
    eDate.setHours(0, 0, 0, 0);

    // فحص ذكرى الخطوبة (اختياري لو حابب تضيفه)
    const isEngAnniversary =
      eDate.getDate() === today.getDate() &&
      eDate.getMonth() === today.getMonth();

    const diffTime = eDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (isEngAnniversary && today.getFullYear() > eDate.getFullYear()) {
      // ذكرى خطوبة
      const years = today.getFullYear() - eDate.getFullYear();
      status.className = "engagement-today"; // نستخدم نفس ستايل الخطوبة
      status.label = `💍 ذكرى خطوبة سعيدة (${years})`;
    } else if (diffDays > 0 && diffDays <= 30) {
      status.className = "engagement-mode";
      status.label = `💍 باقي ${diffDays} يوم ع الخطوبة`;
    } else if (diffDays === 0) {
      status.className = "engagement-today";
      status.label = null;
    } else if (diffDays < 0) {
      status.className = "engagement-mode";
    }
    return status;
  }

  return null;
}
window.editOccasion = (type, oldDate) => {
  const id = document.getElementById("modal-id-display").innerText;
  const action = confirm(
    `إدارة مناسبة الـ ${type === "marriage" ? "زواج" : "خطوبة"}:\n\n` +
      `✅ اضغط "OK" لتغيير التاريخ.\n` +
      `❌ اضغط "Cancel" لحذف المناسبة نهائياً.`
  );

  if (action) {
    const newDate = prompt("أدخل التاريخ الجديد (YYYY-MM-DD):", oldDate);
    if (newDate && newDate !== oldDate) {
      updateOccasionDate(id, type, newDate);
    }
  } else {
    const sure = confirm("هل أنت متأكد من حذف هذه المناسبة وفك الارتباط؟ ⚠️");
    if (sure) {
      deleteOccasion(id, type);
    }
  }
};
async function updateOccasionDate(id, type, newDate) {
  const m = window.currentMembers.find((x) => x.id === id);
  const partnerId = type === "marriage" ? m.spouse : m.fiance;

  try {
    const fieldName = type === "marriage" ? "marriageDate" : "engagementDate";

    // تحديث الطرفين
    await updateDoc(doc(db, "members", id), { [fieldName]: newDate });
    if (partnerId) {
      await updateDoc(doc(db, "members", partnerId), { [fieldName]: newDate });
    }

    window.customAlert("تم تعديل التاريخ بنجاح 📅");
    window.openBio(id); // ريفريش للمودال
  } catch (e) {
    window.customAlert("خطأ: " + e.message);
  }
}
async function deleteOccasion(id, type) {
  const m = window.currentMembers.find((x) => x.id === id);
  const partnerId = type === "marriage" ? m.spouse : m.fiance;

  try {
    const updates = {};

    if (type === "marriage") {
      updates.spouse = null; // حذف الشريك
      updates.marriageDate = null; // حذف التاريخ
      // للطرف الثاني كمان
      if (partnerId) {
        await updateDoc(doc(db, "members", partnerId), {
          spouse: null,
          marriageDate: null,
        });
      }
    } else {
      updates.fiance = null;
      updates.engagementDate = null;
      if (partnerId) {
        await updateDoc(doc(db, "members", partnerId), {
          fiance: null,
          engagementDate: null,
        });
      }
    }

    // تحديث الشخص الحالي
    await updateDoc(doc(db, "members", id), updates);

    window.customAlert("تم حذف المناسبة وفك الارتباط بنجاح 🗑️");
    window.openBio(id); // ريفريش
  } catch (e) {
    window.customAlert("خطأ: " + e.message);
  }
}
window.openOccasionsManager = () => {
  // إخفاء الأقسام الأخرى
  document.getElementById("view-section").style.display = "none";
  document.getElementById("edit-section").style.display = "none";
  document.getElementById("add-section").style.display = "none";

  // إظهار قسم المناسبات
  document.getElementById("occasions-manager-section").style.display = "block";

  // ملء القائمة
  window.renderManageOccasionsList();
};
window.closeOccasionsManager = () => {
  document.getElementById("occasions-manager-section").style.display = "none";

  // التعديل هنا: نخليه يظهر view-section بدل edit-section
  document.getElementById("view-section").style.display = "block";
  document.getElementById("edit-section").style.display = "none";
};
window.renderManageOccasionsList = () => {
  const id = document.getElementById("modal-id-display").innerText;
  const m = window.currentMembers.find((x) => x.id === id);
  const container = document.getElementById("manage-occasions-list");

  container.innerHTML = "";
  let found = false;

  // الحصول على تاريخ اليوم (بدون وقت) للمقارنة
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. فحص الزواج (المستقبلي فقط)
  if (m.marriageDate && m.spouse) {
    const mDate = new Date(m.marriageDate);
    mDate.setHours(0, 0, 0, 0);

    // يظهر فقط لو لسه مجاش
    if (mDate >= today) {
      const spouse = window.currentMembers.find((x) => x.id === m.spouse);
      const name = spouse ? spouse.name : "غير معروف";
      container.innerHTML += createOccasionEditRow(
        "marriage",
        "زواج",
        name,
        m.marriageDate
      );
      found = true;
    }
  }

  // 2. فحص الخطوبة (المستقبلية فقط)
  if (m.engagementDate && m.fiance) {
    const eDate = new Date(m.engagementDate);
    eDate.setHours(0, 0, 0, 0);

    // يظهر فقط لو لسه مجاش
    if (eDate >= today) {
      const fiance = window.currentMembers.find((x) => x.id === m.fiance);
      const name = fiance ? fiance.name : "غير معروف";
      container.innerHTML += createOccasionEditRow(
        "engagement",
        "خطوبة",
        name,
        m.engagementDate
      );
      found = true;
    }
  }

  if (!found) {
    container.innerHTML = `
      <div style="text-align:center; padding:20px; opacity:0.6;">
        لا توجد مناسبات قادمة لتعديلها 🤷‍♂️<br>
        <small>(المناسبات المنتهية تصبح جزءاً من البيانات الثابتة)</small>
      </div>
    `;
  }
};
function createOccasionEditRow(type, title, partnerName, date) {
  return `
    <div class="occasion-edit-card" style="background:rgba(0,0,0,0.05); padding:15px; border-radius:12px; margin-bottom:10px; border:1px solid var(--glass-border);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <strong style="color:var(--primary-glow)">${title} من ${partnerName}</strong>
            <span style="font-size:0.8rem; opacity:0.7">${
              type === "marriage" ? "💍" : "💖"
            }</span>
        </div>
        
        <div style="display:flex; gap:10px; align-items:center;">
            <input type="date" id="edit-date-${type}" value="${date}" class="mini-input" style="flex:1; margin:0 !important;">
            
            <button class="btn-primary" onclick="window.saveOccasionDate('${type}')" style="padding:8px 15px; font-size:0.8rem;">
               حفظ 💾
            </button>
            
            <button class="btn-danger" onclick="window.confirmDeleteOccasion('${type}')" style="padding:8px; width:35px; display:flex; justify-content:center;">
               🗑️
            </button>
        </div>
    </div>
  `;
}
window.saveOccasionDate = async (type) => {
  const id = document.getElementById("modal-id-display").innerText;
  const m = window.currentMembers.find((x) => x.id === id);
  const newDate = document.getElementById(`edit-date-${type}`).value;
  const partnerId = type === "marriage" ? m.spouse : m.fiance;
  const fieldName = type === "marriage" ? "marriageDate" : "engagementDate";

  if (!newDate) return window.customAlert("الرجاء اختيار تاريخ صحيح!");

  try {
    // تحديث الطرفين
    await updateDoc(doc(db, "members", id), { [fieldName]: newDate });
    if (partnerId) {
      await updateDoc(doc(db, "members", partnerId), { [fieldName]: newDate });
    }
    window.customAlert("تم تحديث التاريخ بنجاح ✅");
  } catch (e) {
    window.customAlert("خطأ: " + e.message);
  }
};
window.confirmDeleteOccasion = (type) => {
  const confirmAction = confirm(
    "هل أنت متأكد من حذف هذه المناسبة وفك الارتباط؟ (لا يمكن التراجع) ⚠️"
  );
  if (confirmAction) {
    const id = document.getElementById("modal-id-display").innerText;
    deleteOccasion(id, type).then(() => {
      window.renderManageOccasionsList(); // تحديث القائمة بعد الحذف
    });
  }
};
window.breakMarriage = async () => {
  const id = document.getElementById("modal-id-display").innerText;
  const m = window.currentMembers.find((x) => x.id === id);

  if (!m.spouse) return;

  const confirmDivorce = confirm(
    "هل أنت متأكد من إنهاء الزواج؟ 📜💔\nسيتم فك الارتباط في الشجرة وحذف المناسبة إن وجدت."
  );
  if (!confirmDivorce) return;

  const partnerId = m.spouse;

  try {
    // 1. تنظيف بيانات الشخص الحالي
    // نقوم بتصفير spouse و marriageDate (حتى لو مش موجود هيتمسح أو يفضل null)
    await updateDoc(doc(db, "members", id), {
      spouse: null,
      marriageDate: null,
    });

    // 2. تنظيف بيانات الشريك (الطرف الآخر)
    if (partnerId) {
      await updateDoc(doc(db, "members", partnerId), {
        spouse: null,
        marriageDate: null,
      });
    }

    window.customAlert("تم تسجيل الانفصال وفك الارتباط بنجاح 😔");
    window.toggleEditSection(false); // العودة للبروفايل
    window.openBio(id); // تحديث الواجهة
  } catch (e) {
    console.error(e);
    window.customAlert("حدث خطأ: " + e.message);
  }
};
/* =========================================
 49.marriage Eligibility Check
 ========================================= */
function isMarriageAllowed(personA, personB) {
  if (personA.gender === personB.gender) return false;
  if (personA.parent && personB.parent && personA.parent === personB.parent) {
    return false;
  }
  if (personA.parent === personB.id || personB.parent === personA.id) {
    return false;
  }
  const parentA = window.currentMembers.find((m) => m.id === personA.parent);
  const parentB = window.currentMembers.find((m) => m.id === personB.parent);
  if (
    parentB &&
    parentB.parent &&
    personA.parent &&
    parentB.parent === personA.parent
  )
    return false;
  if (
    parentA &&
    parentA.parent &&
    personB.parent &&
    parentA.parent === personB.parent
  )
    return false;

  return true;
}
/* =========================================
 50. Claim Profile Function
 ========================================= */
window.claimProfile = async (memberId) => {
  if (
    !confirm(
      "هل أنت متأكد أن هذا هو حسابك الشخصي؟\nسيتم ربط بريدك الإلكتروني بهذه الشخصية."
    )
  )
    return;

  // 1. فحوصات الأمان قبل الاتصال
  if (!auth.currentUser) return alert("يجب تسجيل الدخول أولاً!");
  if (!window.currentTreeId) {
    console.error("خطأ: currentTreeId غير معروف");
    return alert(
      "حدث خطأ في تحميل بيانات الشجرة. يرجى تحديث الصفحة والمحاولة مجدداً."
    );
  }

  try {
    const memberRef = doc(
      db,
      "trees",
      window.currentTreeId,
      "members",
      memberId
    );

    // 2. فحص هل البروفايل محجوز (لزيادة التأكيد)
    const mSnap = await getDoc(memberRef);
    if (!mSnap.exists()) return alert("هذا العضو غير موجود!");

    const data = mSnap.data();
    // نتأكد إن الحقل موجود ومش فاضي
    if (data.linkedUserId && data.linkedUserId !== "") {
      return alert("⛔ عذراً، هذا البروفايل تم ربطه بحساب آخر بالفعل!");
    }

    // 3. التنفيذ (إرسال linkedUserId فقط)
    await updateDoc(memberRef, {
      linkedUserId: auth.currentUser.uid,
    });

    // 4. تحديث بيانات المستخدم في كولكشن users
    await setDoc(
      doc(db, "users", auth.currentUser.uid),
      {
        linkedMemberId: memberId,
        linkedTreeId: window.currentTreeId,
        email: auth.currentUser.email,
      },
      { merge: true }
    );

    alert("مبروك! تم ربط حسابك بنجاح. 🎉");
    window.location.reload();
  } catch (e) {
    console.error("خطأ في الربط:", e);
    if (e.code === "permission-denied") {
      // رسالة توضيحية للمستخدم
      alert(
        "⛔ فشل الربط: الصلاحيات غير كافية.\n(تأكد أن البروفايل غير مرتبط بأحد، وأنك لست مرتبطاً ببروفايل آخر)."
      );
    } else {
      alert("خطأ: " + e.message);
    }
  }
};
/* =========================================
 51. Publish My Tree to Public Function
 ========================================= */
window.publishMyTreeToPublic = async () => {
  if (!currentUser) return alert("سجل دخول الأول!");

  // 1. طلب بيانات الشجرة الجديدة
  const familyName = prompt("اكتب اسم العائلة اللي عايز الناس تبحث بيه:");
  const password = prompt("اكتب باسورد للعائلة:");

  if (!familyName || !password) return;

  try {
    // 2. إنشاء "سجل العائلة" في النظام العام
    const newTreeRef = await addDoc(collection(db, "trees"), {
      familyName: familyName,
      password: password,
      creatorId: currentUser.uid,
      createdAt: new Date().toISOString(),
    });

    // 3. نسخ الأعضاء من شجرتك الخاصة للشجرة العامة
    // المصدر: users -> uid -> myTree
    const myPrivateTreeRef = collection(db, "users", currentUser.uid, "myTree");
    const snapshot = await getDocs(myPrivateTreeRef);

    if (snapshot.empty) return alert("شجرتك الخاصة فاضية مفيهاش حد يتنقل!");

    const batch = writeBatch(db); // تأكد إنك عامل import لـ writeBatch فوق
    let count = 0;

    snapshot.docs.forEach((docSnap) => {
      const memberData = docSnap.data();
      // الوجهة: trees -> newID -> members
      const newMemberRef = doc(
        db,
        "trees",
        newTreeRef.id,
        "members",
        docSnap.id
      );

      // إضافة رابط للمؤسس (أنت)
      if (docSnap.id === currentUser.uid || memberData.isRoot) {
        memberData.linkedUserId = currentUser.uid;
      }

      batch.set(newMemberRef, memberData);
      count++;
    });

    await batch.commit();

    // 4. تحديث حسابك ليشير للشجرة الجديدة
    await setDoc(
      doc(db, "users", currentUser.uid),
      {
        linkedTreeId: newTreeRef.id,
      },
      { merge: true }
    );

    alert(
      `تم نشر "عائلة ${familyName}" بنجاح! (${count} فرد)\nالباسورد: ${password}`
    );
    window.location.reload();
  } catch (e) {
    console.error(e);
    alert("خطأ: " + e.message);
  }
};
/* =========================================
 52. Logout Confirmation Modal
 ========================================= */
window.logout = () => {
  const overlay = document.getElementById("logout-confirm-overlay");
  overlay.style.display = "flex";
  // تشغيل أنيميشن الدخول
  overlay.querySelector(".custom-alert").style.animation =
    "contentPopIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
};

window.performLogout = async () => {
  try {
    await signOut(auth);
    window.currentMembers = [];
    window.currentUser = null;
    window.location.href = "index.html";
  } catch (error) {
    console.error("Error signing out:", error);
    window.customAlert("حدث خطأ أثناء تسجيل الخروج");
  }
};

window.closeLogoutModal = () => {
  window.closeModalSmoothly("logout-confirm-overlay");
};

window.customAlert = (message) => {
  const overlay = document.getElementById("google-alert-overlay");
  const msgEl = document.getElementById("google-alert-message");

  if (overlay && msgEl) {
    msgEl.innerText = message;
    overlay.style.display = "flex";
    // صوت تنبيه خفيف (اختياري)
    // const audio = new Audio('alert.mp3'); audio.play().catch(()=>{});
  } else {
    alert(message); // احتياطي لو الـ HTML مش موجود
  }
};

window.closeGoogleAlert = () => {
  window.closeModalSmoothly("google-alert-overlay");
};
/* =========================================
 53. Global Chat Panel Functionality
 ========================================= */

window.toggleChatPanel = () => {
  const panel = document.getElementById("chat-panel");
  const isOpen = panel.classList.contains("open");

  if (isOpen) {
    panel.classList.remove("open");
  } else {
    panel.classList.add("open");
    document.querySelector(".notification-dot").style.display = "none"; // إخفاء التنبيه
    window.loadChatMessages(); // تحميل الرسائل لما تفتح

    // Focus على مربع الكتابة
    setTimeout(() => document.getElementById("global-input").focus(), 300);
  }
};
window.sendMessage = async () => {
  const input = document.getElementById("global-input");
  const text = input.value.trim();
  if (!text) return;

  // تحديد الشجرة المستهدفة
  let targetId = window.currentTreeId;
  if (!targetId && currentUser) {
    // محاولة احتياطية لجلب الشجرة
    try {
      // (نفس الكود القديم لجلب الشجرة...)
      const userSnap = await getDoc(doc(db, "users", currentUser.uid));
      if (userSnap.exists()) targetId = userSnap.data().linkedTreeId;
    } catch (e) {}
  }

  if (!targetId) {
    alert("⛔ خطأ: يجب الانضمام لعائلة أولاً!");
    return;
  }

  // 👇 التعديل هنا: تحديد الصورة
  // لو مفيش صورة، بنحط صورة افتراضية حسب نوعه (ذكر/أنثى) لو عرفنا، أو صورة عامة
  const defaultImg = "mainmale.png";
  const userImg = currentUser.photoURL || defaultImg;

  const msgData = {
    text: text,
    senderId: currentUser.uid,
    senderName: currentUser.displayName || "عضو",
    senderImg: userImg, // ✅ تم إضافة الصورة هنا
    timestamp: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };

  try {
    await addDoc(collection(db, `trees/${targetId}/chat_messages`), msgData);
    input.value = "";
    // إغلاق الإيموجي لو مفتوح
    const emojiPopup = document.getElementById("emoji-popup");
    if (emojiPopup) emojiPopup.classList.remove("show");
  } catch (e) {
    console.error(e);
    alert("❌ فشل الإرسال");
  }
};
window.handleEnter = (e) => {
  if (e.key === "Enter") window.sendMessage();
};
let chatUnsubscribe = null;
window.loadChatMessages = () => {
  if (chatUnsubscribe) return; // منع التكرار
  if (!window.currentTreeId) return;

  const chatRef = collection(db, `trees/${window.currentTreeId}/chat_messages`);
  const q = query(chatRef, orderBy("timestamp", "asc"));

  chatUnsubscribe = onSnapshot(q, (snapshot) => {
    const container = document.getElementById("global-messages");

    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const msg = change.doc.data();
        const now = new Date();

        // عرض الرسالة لو لم تنتهي صلاحيتها
        if (new Date(msg.expiresAt) > now) {
          const isMine = msg.senderId === currentUser.uid;

          // تنسيق الوقت
          const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          // إنشاء "صف" للرسالة عشان يشيل الصورة والفقاعة
          const rowDiv = document.createElement("div");
          rowDiv.className = `msg-row ${isMine ? "row-mine" : "row-others"}`;

          // 👇 تجهيز كود الصورة (تظهر فقط للآخرين)
          const imgHTML = !isMine
            ? `<img src="${
                msg.senderImg || "mainmale.png"
              }" class="chat-avatar" onerror="this.src='mainmale.png'">`
            : ``;

          // 👇 تجهيز المحتوى الداخلي
          rowDiv.innerHTML = `
            ${imgHTML} <div class="msg-bubble ${
            isMine ? "msg-mine" : "msg-others"
          }">
               ${
                 !isMine
                   ? `<div class="msg-sender-name">${msg.senderName}</div>`
                   : ""
               }
               <div class="msg-text">${msg.text}</div>
               <div class="msg-time">${timeStr}</div>
            </div>
          `;

          container.appendChild(rowDiv);
          container.scrollTop = container.scrollHeight;

          // تشغيل الأنيميشن (ورقة الشجر) للرسائل الجديدة فقط
          const msgTime = new Date(msg.timestamp).getTime();
          if (!isFirstLoad && Date.now() - msgTime < 10000 && !isMine) {
            spawnFallingLeaf(msg);
          }
        }
      }
    });

    if (isFirstLoad) isFirstLoad = false;
  });
};
/* =========================================
   NEW CHAT SYSTEM V2 (Private + Auto Delete)
   ========================================= */

let currentChatRoomId = null;
let privateChatUnsubscribe = null;

// 1. فتح وإغلاق اللوحة + التنظيف التلقائي
window.toggleChatPanel = () => {
  const panel = document.getElementById("chat-panel");
  const isOpen = panel.classList.contains("open");

  if (isOpen) {
    panel.classList.remove("open");
  } else {
    panel.classList.add("open");
    document.querySelector(".notification-dot").style.display = "none";

    // الافتراضي: فتح القائمة
    window.showChatList();

    // تشغيل التنظيف التلقائي للرسائل القديمة
    cleanupOldMessages();
  }
};

// 2. التنقل بين الشاشات
window.showChatList = () => {
  document
    .querySelectorAll(".chat-view")
    .forEach((v) => v.classList.remove("active"));
  document.getElementById("chat-list-view").classList.add("active");
  loadPrivateChatsList(); // تحميل القائمة
};

window.openFamilyChat = () => {
  document
    .querySelectorAll(".chat-view")
    .forEach((v) => v.classList.remove("active"));
  document.getElementById("family-chat-view").classList.add("active");
  window.loadChatMessages(); // الدالة القديمة للشات العام
};

// 3. فتح شات خاص
window.openPrivateChat = async (
  targetUid,
  targetName,
  targetImg,
  targetFather
) => {
  if (!currentUser) return alert("يجب تسجيل الدخول");

  document
    .querySelectorAll(".chat-view")
    .forEach((v) => v.classList.remove("active"));
  document.getElementById("private-chat-view").classList.add("active");

  // تحديث الهيدر
  document.getElementById("p-header-img").src = targetImg || "mainmale.png";
  document.getElementById("p-header-name").innerText = targetName;
  document.getElementById("p-header-father").innerText = targetFather
    ? `(${targetFather})`
    : "";
  document.getElementById("p-header-status").innerText = "جاري الاتصال...";

  // تكوين Room ID (ترتيب أبجدي لضمان توحيد الغرفة بين الطرفين)
  const uids = [currentUser.uid, targetUid].sort();
  currentChatRoomId = `${uids[0]}_${uids[1]}`;

  // تحميل الرسائل
  loadPrivateMessages(currentChatRoomId);

  // تحديث حالة الأونلاين (وهمي حالياً أو يمكن ربطه بـ Realtime DB)
  setTimeout(() => {
    document.getElementById("p-header-status").innerText = "🟢 متصل الآن"; // يمكن تطويرها لاحقاً
  }, 1000);
};

function loadPrivateChatsList() {
  const listDiv = document.getElementById("private-chats-list");
  const bigBtn = document.getElementById("big-new-chat-btn");
  const fabBtn = document.getElementById("fab-new-chat-btn");

  if (!currentUser) return;

  const q = query(
    collection(db, "private_chats"),
    where("participants", "array-contains", currentUser.uid),
    orderBy("lastUpdated", "desc")
  );

  onSnapshot(q, (snapshot) => {
    listDiv.innerHTML = "";

    // التحكم في الأزرار
    if (snapshot.empty) {
      if (bigBtn) bigBtn.style.display = "block";
      if (fabBtn) fabBtn.style.display = "none";
      listDiv.innerHTML =
        "<div style='text-align:center; padding:20px; font-size:0.8rem; opacity:0.5'>لا توجد محادثات خاصة.</div>";
    } else {
      if (bigBtn) bigBtn.style.display = "none";
      if (fabBtn) fabBtn.style.display = "flex";
    }

    snapshot.forEach((doc) => {
      const data = doc.data();
      const otherUid = data.participants.find((id) => id !== currentUser.uid);

      // ==========================================
      // 🧠 الحل الذكي: استرجاع البيانات المفقودة
      // ==========================================
      let info = { name: "مستخدم", img: "mainmale.png", father: "" };

      if (data.usersInfo && data.usersInfo[otherUid]) {
        // 1. لو البيانات محفوظة في الشات (الجديد) -> استخدمها
        info = data.usersInfo[otherUid];
      } else {
        // 2. لو البيانات ناقصة (القديم) -> دور عليها في أعضاء الشجرة الحالية
        if (window.currentMembers) {
          const localMember = window.currentMembers.find(
            (m) => m.linkedUserId === otherUid
          );
          if (localMember) {
            info.name = localMember.name;
            info.img = localMember.img || "mainmale.png";

            // محاولة جلب اسم الأب محلياً
            const dad = window.currentMembers.find(
              (p) => p.id === localMember.parent
            );
            if (dad) info.father = dad.name;
          }
        }
      }
      // ==========================================

      let timeStr = "";
      if (data.lastUpdated) {
        const date = data.lastUpdated.toDate
          ? data.lastUpdated.toDate()
          : new Date(data.lastUpdated);
        timeStr = date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      }

      const item = document.createElement("div");
      item.className = "chat-list-item";
      item.onclick = () =>
        window.openPrivateChat(otherUid, info.name, info.img, info.father);

      item.innerHTML = `
                <div class="chat-item-avatar">
                    <img src="${info.img}" onerror="this.src='mainmale.png'">
                </div>
                <div class="chat-item-info">
                    <div class="chat-item-top">
                        <span class="chat-item-name">${info.name}</span>
                        <span style="font-size:0.65rem; opacity:0.6">${timeStr}</span>
                    </div>
                    <span class="chat-item-last-msg">${
                      data.lastMessage || "مرفق..."
                    }</span>
                </div>
            `;
      listDiv.appendChild(item);
    });
  });
}
// 5. تحميل رسائل الشات الخاص
function loadPrivateMessages(roomId) {
  const container = document.getElementById("private-messages");
  container.innerHTML = ""; // تنظيف

  if (privateChatUnsubscribe) privateChatUnsubscribe();

  const q = query(
    collection(db, "private_chats", roomId, "messages"),
    orderBy("timestamp", "asc"),
    limit(50)
  );

  privateChatUnsubscribe = onSnapshot(q, (snapshot) => {
    container.innerHTML = "";
    snapshot.forEach((doc) => {
      const msg = doc.data();
      const isMine = msg.senderId === currentUser.uid;
      const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      const div = document.createElement("div");
      div.className = `msg-row ${isMine ? "row-mine" : "row-others"}`;
      div.innerHTML = `
                ${
                  !isMine
                    ? `<img src="${msg.senderImg}" class="chat-avatar">`
                    : ""
                }
                <div class="msg-bubble ${isMine ? "msg-mine" : "msg-others"}">
                    <div class="msg-text">${msg.text}</div>
                    <div class="msg-time">${timeStr}</div>
                </div>
            `;
      container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
  });
}

// 6. الإرسال الموحد (عام وخاص)
window.sendMessage = async (type) => {
  const inputId = type === "global" ? "global-input" : "private-input";
  const input = document.getElementById(inputId);
  const text = input.value.trim();
  if (!text) return;

  const userImg = currentUser.photoURL || "mainmale.png";
  const msgData = {
    text: text,
    senderId: currentUser.uid,
    senderName: currentUser.displayName,
    senderImg: userImg,
    timestamp: new Date().toISOString(),
  };

  try {
    if (type === "global") {
      // كود الشات العام القديم (مع إضافة expiresAt للتنظيف)
      // التنظيف بعد 7 أيام (1000 * 60 * 60 * 24 * 7)
      msgData.expiresAt = new Date(Date.now() + 604800000).toISOString();

      await addDoc(
        collection(db, `trees/${window.currentTreeId}/chat_messages`),
        msgData
      );
    } else {
      // كود الشات الخاص
      if (!currentChatRoomId) return;

      // 1. إضافة الرسالة في Sub-collection
      await addDoc(
        collection(db, "private_chats", currentChatRoomId, "messages"),
        msgData
      );

      // 2. تحديث بيانات الغرفة (آخر رسالة) ليظهر في القائمة
      // نحتاج بياناتي وبيانات الطرف الآخر لتخزينها في usersInfo للسرعة
      // (في تطبيق حقيقي ممكن تجيبها من المستخدمين، هنا هنفترض إننا بنحدثها مع كل رسالة)
      const otherUid = currentChatRoomId
        .replace(currentUser.uid, "")
        .replace("_", "");

      // تحديث الوثيقة الرئيسية للغرفة
      await setDoc(
        doc(db, "private_chats", currentChatRoomId),
        {
          participants: [currentUser.uid, otherUid],
          lastMessage: text,
          lastUpdated: new Date().toISOString(),
          // تحديث معلوماتي أنا (عشان تظهر عند الطرف التاني)
          [`usersInfo.${currentUser.uid}`]: {
            name: currentUser.displayName,
            img: userImg,
            // بنحاول نجيب اسم الأب لو متاح
            father: getMyFatherName(),
          },
        },
        { merge: true }
      );
    }

    input.value = "";
  } catch (e) {
    console.error("Send Error:", e);
  }
};

// دالة مساعدة لجلب اسم الأب
function getMyFatherName() {
  if (!window.currentMembers || !window.currentUserLinkedMemberId) return "";
  const me = window.currentMembers.find(
    (m) => m.id === window.currentUserLinkedMemberId
  );
  if (me && me.parent) {
    const dad = window.currentMembers.find((m) => m.id === me.parent);
    return dad ? dad.name : "";
  }
  return "";
}

// 7. دالة التنظيف التلقائي (Auto Delete from Firebase)
async function cleanupOldMessages() {
  // هذه الدالة تعمل عند فتح الشات العام
  if (!window.currentTreeId) return;

  const chatRef = collection(db, `trees/${window.currentTreeId}/chat_messages`);
  const now = new Date().toISOString();

  // استعلام عن الرسائل التي انتهت صلاحيتها
  const q = query(chatRef, where("expiresAt", "<", now), limit(50)); // نحذف 50 بـ 50 عشان الأداء

  try {
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const batch = writeBatch(db);
      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`🧹 تم تنظيف ${snapshot.size} رسالة قديمة من السيرفر.`);
    }
  } catch (e) {
    console.error("Cleanup Error:", e);
    // غالباً الخطأ هيكون بسبب نقص Index، الفايربيس هيديك لينك في الكونسول لإنشائه
  }
}

// 8. البحث عن مستخدم لبدء شات
window.showUserSearchForChat = () => {
  const box = document.getElementById("chat-user-search-box");
  box.style.display = box.style.display === "none" ? "block" : "none";
  if (box.style.display === "block")
    document.getElementById("chat-search-input").focus();
};

window.searchUserForChat = (val) => {
  const resDiv = document.getElementById("chat-search-results");
  resDiv.innerHTML = "";
  if (!val) return;

  // البحث في الأعضاء المحملين حالياً (Local Search for Speed)
  const matches = window.currentMembers.filter(
    (m) =>
      m.name.toLowerCase().includes(val.toLowerCase()) &&
      m.linkedUserId && // لازم يكون مربوط بحساب عشان نكلمه
      m.linkedUserId !== currentUser.uid // مكلمش نفسي
  );

  matches.forEach((m) => {
    const parent = window.currentMembers.find((p) => p.id === m.parent);
    const fatherName = parent ? parent.name : "";

    const div = document.createElement("div");
    div.className = "search-item";
    div.innerHTML = `
            <img src="${m.img}" style="width:30px; height:30px; border-radius:50%">
            <div>
                <div style="font-weight:bold">${m.name}</div>
                <div style="font-size:0.7rem; opacity:0.7">${fatherName}</div>
            </div>
        `;
    div.onclick = () => {
      window.openPrivateChat(m.linkedUserId, m.name, m.img, fatherName);
      document.getElementById("chat-user-search-box").style.display = "none";
    };
    resDiv.appendChild(div);
  });

  if (matches.length === 0) {
    resDiv.innerHTML =
      "<div style='padding:5px; font-size:0.7rem'>لا يوجد عضو بهذا الاسم مرتبط بحساب</div>";
  }
};

// تعديل بسيط لزر الإدخال (Enter) ليدعم النوعين
window.handleEnter = (e, type) => {
  if (e.key === "Enter") window.sendMessage(type);
};
/* =========================================
 54. Emoji Picker Integration
 ========================================= */
window.toggleEmojiPicker = () => {
  const picker = document.getElementById("emoji-popup");
  picker.classList.toggle("show");
};
document.addEventListener("DOMContentLoaded", () => {
  const pickerElement = document.querySelector("emoji-picker");
  const inputField = document.getElementById("global-input");

  if (pickerElement && inputField) {
    pickerElement.addEventListener("emoji-click", (event) => {
      // إضافة الإيموجي في مكان المؤشر أو في الآخر
      const emoji = event.detail.unicode;
      inputField.value += emoji;

      // إبقاء التركيز على مربع الكتابة
      inputField.focus();
    });
  }

  // إغلاق القائمة عند الضغط خارجها
  document.addEventListener("click", (e) => {
    const pickerContainer = document.getElementById("emoji-popup");
    const btn = document.querySelector(".emoji-btn");

    // لو الضغطة مش جوه القائمة ومش على الزرار، اقفل القائمة
    if (
      pickerContainer.classList.contains("show") &&
      !pickerContainer.contains(e.target) &&
      !btn.contains(e.target)
    ) {
      pickerContainer.classList.remove("show");
    }
  });
});
const originalSendMessage = window.sendMessage;
window.sendMessage = async () => {
  await originalSendMessage();
  document.getElementById("emoji-popup").classList.remove("show");
};
/* =========================================
 55. Navigation Menu Toggle Logic
 ========================================= */
window.toggleNavMenu = () => {
  const grid = document.getElementById("nav-menu-grid");
  const btn = document.querySelector(".nav-toggle-btn");

  // تبديل الكلاسات
  grid.classList.toggle("open");
  btn.classList.toggle("active");

  // أنيميشن صغير للعناصر (Staggered Animation)
  if (grid.classList.contains("open")) {
    const items = grid.querySelectorAll(".grid-item");
    items.forEach((item, index) => {
      item.style.opacity = "0";
      item.style.transform = "translateY(10px)";
      setTimeout(() => {
        item.style.transition = "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)";
        item.style.opacity = "1";
        item.style.transform = "translateY(0)";
      }, 50 + index * 50); // تأخير 50ms بين كل عنصر
    });
  }
};

document.addEventListener("click", (e) => {
  const grid = document.getElementById("nav-menu-grid");
  const btn = document.querySelector(".nav-toggle-btn");

  // إضافة شرط (grid && btn) للتأكد من وجودهم قبل العمل
  if (grid && btn && grid.classList.contains("open")) {
    if (!grid.contains(e.target) && !btn.contains(e.target)) {
      window.toggleNavMenu();
    }
  }
});
/* =========================================
 56. Global Search Functionality
 ========================================= */
window.openGlobalSearch = () => {
  const modal = document.getElementById("global-search-modal");
  if (modal) {
    modal.style.display = "flex";
    modal.classList.remove("hidden");
    // تركيز المؤشر في الكتابة
    setTimeout(
      () => document.getElementById("global-search-input").focus(),
      100
    );
  } else {
    console.error("عنصر المودال global-search-modal غير موجود في HTML");
  }
};

window.closeGlobalSearch = () => {
  document.getElementById("global-search-modal").style.display = "none";
};

let globalSearchTimeout;
window.handleGlobalSearch = (term) => {
  clearTimeout(globalSearchTimeout);
  const resultsDiv = document.getElementById("global-results-container");

  if (term.length < 3) {
    resultsDiv.innerHTML =
      '<div style="color:#aaa; text-align:center;">اكتب 3 حروف على الأقل...</div>';
    return;
  }

  resultsDiv.innerHTML =
    '<div style="text-align:center;">⏳ جاري البحث...</div>';

  globalSearchTimeout = setTimeout(async () => {
    try {
      const { collectionGroup, query, where, getDocs, limit } = await import(
        "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
      );

      // التعديل هنا: استخدام db بدلاً من window.db
      const membersQuery = query(
        collectionGroup(db, "members"),
        where("name", ">=", term),
        where("name", "<=", term + "\uf8ff"),
        limit(10)
      );

      const snapshot = await getDocs(membersQuery);

      resultsDiv.innerHTML = "";

      if (snapshot.empty) {
        resultsDiv.innerHTML =
          '<div style="text-align:center;">لا توجد نتائج 😕</div>';
        return;
      }

      snapshot.forEach((docSnap) => {
        const member = docSnap.data();
        const card = document.createElement("div");
        card.style.cssText =
          "background:rgba(255,255,255,0.05); padding:10px; margin-bottom:8px; border-radius:8px; display:flex; align-items:center; gap:10px; border:1px solid rgba(255,255,255,0.1);";

        card.innerHTML = `
            <img src="${member.img || "mainmale.png"}" 
                 style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
            <div>
                <div style="font-weight:bold; color:white;">${member.name}</div>
                <div style="font-size:0.8rem; color:#aaa;">${
                  member.gender === "male" ? "ذكر" : "أنثى"
                }</div>
            </div>
            <button onclick="copyMemberId('${docSnap.id}')" 
                    style="margin-right:auto; background:#10b981; border:none; color:white; padding:5px 10px; border-radius:5px; cursor:pointer; font-size:0.8rem;">
                    نسخ الكود
            </button>
        `;
        resultsDiv.appendChild(card);
      });
    } catch (error) {
      console.error("تفاصيل خطأ البحث:", error);

      // كشف الخطأ الحقيقي للمستخدم
      if (error.message.includes("indexes")) {
        resultsDiv.innerHTML = `
            <div style="color:#fbbf24; text-align:center; font-size:0.9rem; padding:10px; direction:ltr;">
               ⚠️ مطلوب تفعيل الفهرس (Index)<br>
               <a href="${
                 error.message.match(/https:\/\/[^\s]+/)[0]
               }" target="_blank" style="color:#3b82f6; text-decoration:underline;">اضغط هنا لإنشائه</a>
            </div>`;
      } else {
        resultsDiv.innerHTML = `<div style="color:red; text-align:center;">خطأ: ${error.message}</div>`;
      }
    }
  }, 800);
};

window.copyMemberId = (id) => {
  navigator.clipboard.writeText(id);
  window.showNotification("تم نسخ الكود! استخدمه للربط", "success");
  window.closeGlobalSearch();
};
/* =========================================
 57. Admin Permissions Management
 ========================================= */
async function checkAdminStatus() {
  // 1. التأكد من وجود البيانات الأساسية
  if (!window.currentTreeId) {
    console.warn("⚠️ checkAdminStatus: لا يوجد ID للشجرة حالياً.");
    return;
  }
  if (!auth.currentUser) {
    console.warn("⚠️ checkAdminStatus: المستخدم غير مسجل دخول.");
    return;
  }

  try {
    // 2. جلب بيانات الشجرة
    const treeDocRef = doc(db, "trees", window.currentTreeId);
    const treeSnap = await getDoc(treeDocRef);

    if (treeSnap.exists()) {
      const data = treeSnap.data();
      const myUid = auth.currentUser.uid;

      console.log("🔍 فحص الصلاحيات للمستخدم:", myUid);
      console.log("📄 بيانات الشجرة:", data);

      // 3. تحديد المالك
      // الكود يدعم المسميات القديمة والجديدة
      const realOwnerId = data.ownerId || data.adminId || data.creatorId;
      window.isTreeOwner = realOwnerId === myUid;

      console.log("👑 هل أنا المالك؟", window.isTreeOwner);

      // 4. جلب خريطة الصلاحيات
      const permsMap = data.adminPermissions || {};
      const myPerms = permsMap[myUid] || [];

      // 5. تحديد المتغيرات العامة
      window.canAdd = window.isTreeOwner || myPerms.includes("add");
      window.canEdit = window.isTreeOwner || myPerms.includes("edit");
      window.canDelete = window.isTreeOwner || myPerms.includes("delete");

      // 6. إظهار زر الإعدادات (الترس)
      const settingsBtn = document.getElementById("settings-btn");
      const isAnyAdmin = window.isTreeOwner || myPerms.length > 0;

      if (settingsBtn) {
        if (isAnyAdmin) {
          settingsBtn.style.display = "flex"; // أو inline-block حسب التنسيق
          console.log("✅ تم إظهار زر الإعدادات.");
        } else {
          settingsBtn.style.display = "none";
          console.log("❌ المستخدم ليس أدمن، الزر مخفي.");
        }
      }

      // 7. تحديث باقي الواجهة (أزرار الحذف والإضافة)
      updateUIBasedOnPermissions();
    } else {
      console.error("❌ وثيقة الشجرة غير موجودة في الداتابيز!");
    }
  } catch (error) {
    console.error("❌ خطأ في التحقق من الصلاحيات:", error);
  }
}

// إخفاء وإظهار الأزرار داخل الشجرة بناءً على الصلاحيات
function updateUIBasedOnPermissions() {
  // مثال: أزرار الحذف تظهر فقط لمن يملك canDelete
  const deleteBtns = document.querySelectorAll(".action-btn-delete"); // تأكد من الكلاس في HTML
  deleteBtns.forEach((btn) => {
    btn.style.display = window.canDelete ? "inline-block" : "none";
  });

  // زر الإضافة
  const addBtns = document.querySelectorAll(".add-member-btn");
  addBtns.forEach((btn) => {
    btn.style.display = window.canAdd ? "flex" : "none";
  });
}

/* ==========================================================================
   🧩 القسم 2: عرض قائمة المدراء (Settings Modal)
   ========================================================================== */

// فتح المودال الرئيسي
window.openTreeSettings = async () => {
  const modal = document.getElementById("tree-settings-modal");
  modal.style.display = "flex";

  // قسم نقل الملكية يظهر للمالك فقط
  const transferSection = document.getElementById("owner-only-section");
  if (transferSection) {
    transferSection.style.display = window.isTreeOwner ? "block" : "none";
  }

  // تحميل القائمة
  await loadAdminsList();
};

// جلب البيانات ورسم القائمة
window.loadAdminsList = async () => {
  const listDiv = document.getElementById("admins-list");
  listDiv.innerHTML =
    '<div style="text-align:center; color:#aaa">⏳ جاري تحميل المدراء...</div>';

  try {
    const { getDoc, doc } = await import(
      "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
    );
    const treeSnap = await getDoc(doc(db, "trees", window.currentTreeId));
    const data = treeSnap.data();

    // المصدر الرئيسي للصلاحيات هو adminPermissions
    const adminPerms = data.adminPermissions || {};

    listDiv.innerHTML = "";

    // لو مفيش مدراء
    if (Object.keys(adminPerms).length === 0) {
      listDiv.innerHTML =
        "<div style='opacity:0.7; text-align:center; padding:10px;'>لا يوجد مساعدين حالياً</div>";
      return;
    }

    // تكرار المدراء وعرضهم
    for (const [uid, perms] of Object.entries(adminPerms)) {
      // جلب الاسم والإيميل
      let adminName = "مستخدم";
      let adminEmail = "...";
      try {
        const uSnap = await getDoc(doc(db, "users", uid));
        if (uSnap.exists()) {
          adminName = uSnap.data().name;
          adminEmail = uSnap.data().email;
        }
      } catch (e) {}

      // إنشاء عنصر الواجهة (HTML)
      const row = document.createElement("div");
      row.className = "admin-row";
      row.style.cssText =
        "background:rgba(255,255,255,0.05); padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.1);";

      // أدوات التحكم (تظهر للمالك فقط ليعدل على مساعديه)
      // المساعد لا يستطيع تعديل صلاحيات مساعد آخر
      const controls = window.isTreeOwner
        ? `
        <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.1);">
           <label style="font-size:0.8rem; cursor:pointer; color:#fff;">
              <input type="checkbox" ${perms.includes("add") ? "checked" : ""} 
              onchange="updateAdminPerm('${uid}', 'add', this.checked)"> إضافة
           </label>
           <label style="font-size:0.8rem; cursor:pointer; color:#fff;">
              <input type="checkbox" ${perms.includes("edit") ? "checked" : ""} 
              onchange="updateAdminPerm('${uid}', 'edit', this.checked)"> تعديل
           </label>
           <label style="font-size:0.8rem; cursor:pointer; color:#fff;">
              <input type="checkbox" ${
                perms.includes("delete") ? "checked" : ""
              } 
              onchange="updateAdminPerm('${uid}', 'delete', this.checked)"> حذف
           </label>
           <button onclick="removeAdmin('${uid}')" style="margin-right:auto; color:#ff4757; background:none; border:none; cursor:pointer; font-size:0.9rem;">🗑️ طرد</button>
        </div>
      `
        : `<div style="font-size:0.8rem; color:#aaa; margin-top:5px;">الصلاحيات: ${perms.join(
            " - "
          )}</div>`;

      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            <div style="background:#10b981; color:white; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold;">${adminName.charAt(
              0
            )}</div>
            <div>
                <div style="font-weight:bold; color:white;">${adminName}</div>
                <div style="font-size:0.7rem; color:#aaa;">${adminEmail}</div>
            </div>
        </div>
        ${controls}
      `;
      listDiv.appendChild(row);
    }
  } catch (e) {
    console.error(e);
    listDiv.innerHTML = "حدث خطأ أثناء التحميل";
  }
};

/* ==========================================================================
   🧩 القسم 3: إدارة المدراء (إضافة - تعديل - حذف)
   ========================================================================== */

// 1. إضافة مدير جديد
window.addNewAdmin = async () => {
  if (!window.isTreeOwner) return alert("❌ هذا الإجراء للمالك فقط!");

  const email = document.getElementById("new-admin-email").value.trim();

  // تجميع الصلاحيات المختارة
  const perms = [];
  if (document.getElementById("perm-add").checked) perms.push("add");
  if (document.getElementById("perm-edit").checked) perms.push("edit");
  if (document.getElementById("perm-delete").checked) perms.push("delete");

  if (!email) return alert("الرجاء كتابة البريد الإلكتروني");
  if (perms.length === 0) return alert("يجب اختيار صلاحية واحدة على الأقل");

  try {
    const { collection, query, where, getDocs, updateDoc, doc } = await import(
      "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
    );

    // البحث عن المستخدم
    const q = query(collection(db, "users"), where("email", "==", email));
    const snap = await getDocs(q);

    if (snap.empty) return alert("⚠️ هذا المستخدم غير مسجل في التطبيق!");

    const newUid = snap.docs[0].id;
    if (newUid === auth.currentUser.uid) return alert("لا يمكنك إضافة نفسك!");

    // التحديث: إضافة مدخل جديد في خريطة adminPermissions
    const updatePayload = {};
    updatePayload[`adminPermissions.${newUid}`] = perms;

    // وأيضاً نضيفه في مصفوفة admins القديمة احتياطياً (اختياري)
    // لكن الأهم هو adminPermissions

    await updateDoc(doc(db, "trees", window.currentTreeId), updatePayload);

    alert(`✅ تم تعيين ${snap.docs[0].data().name} كمساعد بنجاح!`);
    document.getElementById("new-admin-email").value = ""; // تفريغ الحقل
    loadAdminsList(); // تحديث القائمة
  } catch (e) {
    console.error(e);
    alert("حدث خطأ: " + e.message);
  }
};

// 2. تحديث صلاحية (عند الضغط على Checkbox)
window.updateAdminPerm = async (uid, permType, isChecked) => {
  try {
    const { getDoc, doc, updateDoc } = await import(
      "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
    );
    const treeRef = doc(db, "trees", window.currentTreeId);

    const snap = await getDoc(treeRef);
    let currentPerms = snap.data().adminPermissions[uid] || [];

    if (isChecked) {
      if (!currentPerms.includes(permType)) currentPerms.push(permType);
    } else {
      currentPerms = currentPerms.filter((p) => p !== permType);
    }

    const updatePayload = {};
    updatePayload[`adminPermissions.${uid}`] = currentPerms;

    await updateDoc(treeRef, updatePayload);
    // لا نحتاج لإعادة تحميل القائمة بالكامل هنا لتجنب وميض الشاشة، التعديل تم في الخلفية
    console.log(`Permission ${permType} updated for ${uid}`);
  } catch (e) {
    alert("فشل تحديث الصلاحية: " + e.message);
  }
};

// 3. حذف مدير
window.removeAdmin = async (uid) => {
  if (!confirm("هل أنت متأكد من حذف هذا المساعد نهائياً؟")) return;

  try {
    const { doc, updateDoc, deleteField } = await import(
      "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
    );

    const updatePayload = {};
    // مسح المفتاح بالكامل من الخريطة
    updatePayload[`adminPermissions.${uid}`] = deleteField();

    await updateDoc(doc(db, "trees", window.currentTreeId), updatePayload);

    loadAdminsList(); // تحديث القائمة
    alert("تم الحذف بنجاح 🗑️");
  } catch (e) {
    alert("خطأ: " + e.message);
  }
};

/* ==========================================================================
   🧩 القسم 4: وظائف المالك المتقدمة (Transfer & Migrate)
   ========================================================================== */

// نقل ملكية الشجرة
window.transferOwnership = async () => {
  if (!window.isTreeOwner) return;

  const email = prompt(
    "⚠️ تحذير خطير!\nسيتم نقل ملكية الشجرة بالكامل ولن تصبح المالك بعد الآن.\n\nأدخل بريد المالك الجديد للتأكيد:"
  );
  if (!email) return;

  try {
    const { collection, query, where, getDocs, updateDoc, doc } = await import(
      "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
    );

    const q = query(collection(db, "users"), where("email", "==", email));
    const snap = await getDocs(q);

    if (snap.empty) return alert("المستخدم غير موجود!");

    const newOwnerUid = snap.docs[0].id;
    const newOwnerName = snap.docs[0].data().name;

    if (!confirm(`هل أنت متأكد 100% من نقل الملكية إلى (${newOwnerName})؟`))
      return;

    // نقل الملكية: تغيير ownerId
    // وأيضاً: إعطاء المالك القديم (أنا) صلاحيات أدمن كاملة عشان ميتطردش
    const updatePayload = {
      ownerId: newOwnerUid,
    };
    updatePayload[`adminPermissions.${auth.currentUser.uid}`] = [
      "add",
      "edit",
      "delete",
    ];

    await updateDoc(doc(db, "trees", window.currentTreeId), updatePayload);

    alert("✅ تمت العملية بنجاح. سيتم إعادة تحميل الصفحة.");
    location.reload();
  } catch (e) {
    alert("خطأ: " + e.message);
  }
};

// زر الإصلاح (يظهر لو الشجرة قديمة)
window.migrateTreeData = async () => {
  if (!window.currentTreeId) return alert("انتظر تحميل الشجرة");

  if (
    !confirm(
      "سيتم تحديث هيكلية الشجرة لتتوافق مع نظام الصلاحيات الجديد. متابعة؟"
    )
  )
    return;

  try {
    const { getDoc, doc, updateDoc } = await import(
      "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
    );
    const treeRef = doc(db, "trees", window.currentTreeId);
    const snap = await getDoc(treeRef);
    const data = snap.data();

    const owner = data.ownerId || data.adminId || data.creatorId;
    const oldAdmins = data.admins || [];
    const newPerms = data.adminPermissions || {};

    // تحويل كل الأدمنز القدام لـ خريطة صلاحيات كاملة
    oldAdmins.forEach((uid) => {
      if (uid !== owner && !newPerms[uid]) {
        newPerms[uid] = ["add", "edit", "delete"];
      }
    });

    await updateDoc(treeRef, {
      ownerId: owner,
      adminPermissions: newPerms,
    });

    alert("✅ تم التحديث! النظام جاهز.");
    location.reload();
  } catch (e) {
    alert("خطأ: " + e.message);
  }
};
