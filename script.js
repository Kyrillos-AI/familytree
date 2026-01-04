import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
/* التحقق من وجود ID في الرابط عند فتح الصفحة */
const urlParams = new URLSearchParams(window.location.search);
const sharedId = urlParams.get("id");

if (sharedId) {
  currentFocusId = sharedId;
  viewMode = "perspective";
}

const relationNames = {
  child: { male: "ابنـي", female: "بنتـي" },
  sibling: { male: "أخويـا", female: "أختـي" },
  parent: { male: "أبـويا", female: "أمـي" },
  spouse: { male: "جوزي", female: "مراتـي" },
  uncle_aunt: { male: "عمـي", female: "عمتـي" },
  maternal_sibling: { male: "خالـي", female: "خالتـي" },
};

let isFirstLoad = true; // تعريف المتغير في النطاق العام

// دالة مراقبة واحدة فقط ونظيفة
onSnapshot(collection(db, "members"), (snapshot) => {
  const members = [];
  snapshot.forEach((doc) => members.push({ id: doc.id, ...doc.data() }));
  window.currentMembers = members;

  refreshUI();

  // إخفاء اللودر عند أول تحميل
  if (isFirstLoad) {
    const lw = document.getElementById("loader-wrapper");
    if (lw) {
      setTimeout(() => {
        lw.style.opacity = "0";
        lw.style.transform = "scale(1.1)";
        document.body.style.overflow = "auto";
        document.body.style.overflowX = "hidden";
        setTimeout(() => lw.remove(), 500);
      }, 3500);
    }
    isFirstLoad = false;
  }
});

/* تحديث الواجهة مع تأخير ذكي لرسم الخطوط لمنع الأخطاء */
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

// تحديث دالة الشجرة الكاملة لمنع تسرب الفروع الخاصة
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

/* تحديث دالة المنظور: أخوال منفصلين بدون خطوط في صفحتك، ومتصلين في صفحتهم */
function renderPerspectiveTree(focusId, allMembers) {
  viewMode = "perspective";
  const container = document.getElementById("tree-container");
  const svg = document.getElementById("tree-svg");
  container.innerHTML = "";
  svg.innerHTML = "";

  const person = allMembers.find((m) => m.id === focusId);
  if (!person) return window.showFullTree();

  const isMale = person.gender === "male";

  // 1. تحديد الأزواج
  const spouses = allMembers.filter(
    (m) => m.id === person.spouse || m.spouse === focusId
  );
  const spouseIds = spouses.map((s) => s.id);
  const spouseId =
    person.spouse || allMembers.find((m) => m.spouse === focusId)?.id;

  // 2. الأبناء
  const fatherOfChildrenId = isMale ? focusId : spouseId;
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
/* تحديث دالة البحث لإظهار اسم الأب لتمييز المتشابهين */
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
// ميزة تعديل البيانات
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
    document.getElementById("edit-name").value = m.name;
    document.getElementById("edit-img").value = m.img;
  }
};

/* دالة الإضافة والربط المصححة */
window.addNewRelative = async () => {
  const focusId = document.getElementById("modal-id-display").innerText;
  const existingId = document.getElementById("new-existing-member").value; // الشخص المختار للربط
  const type = document.getElementById("relation-type").value;
  const focusPerson = window.currentMembers.find((m) => m.id === focusId);

  // تجميع البيانات الأساسية من الخانات (في حال إضافة فرد جديد)
  const name = document.getElementById("new-name").value;
  const dob = document.getElementById("new-dob").value;
  const gender = document.getElementById("new-gender").value;
  const isPrivate = document.getElementById("new-hide-main").checked;
  const isDeceased = document.getElementById("new-is-deceased").checked;
  const deathDate = document.getElementById("new-death-date").value; // قراءة التاريخ
  const imgInput = document.getElementById("new-img").value;
  const defaultImg = gender === "female" ? "mainfemale.png" : "mainmale.png";

  // تجميع بيانات السوشيال ميديا الديناميكية للإضافة
  const socialData = { wa: "", fb: "", inst: "", tt: "", tg: "", phone: "" };
  document
    .querySelectorAll("#new-social-list .social-input-row")
    .forEach((row) => {
      const sType = row.querySelector(".social-type").value;
      const sVal = row.querySelector(".social-value").value;
      if (sVal) socialData[sType] = sVal;
    });

  try {
    const lvl = focusPerson ? parseInt(focusPerson.level) || 1 : 1;

    // 1. حالة "الربط": تحديث بيانات شخص موجود فعلياً
    if (existingId) {
      let updateFields = {};

      if (type === "child") {
        updateFields = { parent: focusId, level: lvl + 1 };
      } else if (type === "parent") {
        await updateDoc(doc(db, "members", focusId), { parent: existingId });
        updateFields = { level: lvl - 1 };
      } else if (type === "spouse") {
        await updateDoc(doc(db, "members", focusId), { spouse: existingId });
        updateFields = { spouse: focusId, level: lvl };
      } else if (type === "sibling") {
        updateFields = { parent: focusPerson.parent || null, level: lvl };
      } else if (type === "uncle_aunt") {
        const father = focusPerson.parent
          ? window.currentMembers.find((m) => m.id === focusPerson.parent)
          : null;
        if (father && father.parent)
          updateFields = { parent: father.parent, level: father.level };
        else return window.customAlert("يجب إضافة الجد أولاً لربط الأعمام");
      } else if (type === "maternal_sibling") {
        const father = focusPerson.parent
          ? window.currentMembers.find((m) => m.id === focusPerson.parent)
          : null;
        const mother = father
          ? window.currentMembers.find(
              (m) => m.id === father.spouse || m.spouse === father.id
            )
          : null;
        if (mother && mother.parent)
          updateFields = { parent: mother.parent, level: mother.level };
        else
          return window.customAlert("يجب إضافة الأم والجد أولاً لربط الأخوال");
      }

      await updateDoc(doc(db, "members", existingId), updateFields);
      window.customAlert("تم ربط الفرد بنجاح! 🔗");
    }
    // 2. حالة "الإضافة": إنشاء شخص جديد تماماً
    else {
      if (!name) return window.customAlert("الاسم مطلوب لإضافة فرد جديد ⚠️");

      let newData = {
        name,
        dob, // تأكد اننا بنبعت تاريخ الميلاد
        gender,
        isPrivate,
        isDeceased,
        deathDate,
        img: imgInput || defaultImg,
        ...socialData,
      };

      if (focusId && focusPerson) {
        if (type === "child") {
          newData.parent = focusId;
          newData.level = lvl + 1;
        } else if (type === "parent") {
          const newDoc = await addDoc(collection(db, "members"), {
            ...newData,
            level: lvl - 1,
          });
          await updateDoc(doc(db, "members", focusId), { parent: newDoc.id });
          window.customAlert("تمت إضافة الوالد بنجاح! 🎉");
          return window.closeBio();
        } else if (type === "spouse") {
          newData.spouse = focusId;
          newData.level = lvl;
        } else if (type === "sibling") {
          newData.parent = focusPerson.parent || null;
          newData.level = lvl;
        } else if (type === "uncle_aunt" || type === "maternal_sibling") {
          // سيتم تحديد الـ parent والـ level بناءً على المنطق المعتمد للأقارب
          // لضمان البساطة، سنطبق نفس منطق الربط هنا عند الإنشاء الجديد
          const father = focusPerson.parent
            ? window.currentMembers.find((m) => m.id === focusPerson.parent)
            : null;
          if (type === "uncle_aunt") {
            if (father && father.parent) {
              newData.parent = father.parent;
              newData.level = father.level;
            }
          } else {
            const mother = father
              ? window.currentMembers.find(
                  (m) => m.id === father.spouse || m.spouse === father.id
                )
              : null;
            if (mother && mother.parent) {
              newData.parent = mother.parent;
              newData.level = mother.level;
            }
          }
        }
      } else {
        newData.level = 1;
      }

      await addDoc(collection(db, "members"), newData);
      window.customAlert("تمت إضافة الفرد بنجاح! 🎉");
    }

    window.closeBio();
  } catch (e) {
    window.customAlert("حدث خطأ: " + e.message);
  }
};
/* وظيفة قفل الخانات عند اختيار شخص للربط */
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
function createCardIn(div, m, label, cls = "") {
  const card = document.createElement("div");

  // 1. تحديد كلاسات الجنس والحجم
  const genderClass = m.gender === "female" ? "female-card" : "male-card";
  const sizeClass = m.level > 2 ? "card-small" : "";

  // 2. إعداد الكلاسات الأساسية
  let finalClasses = `member-card ${genderClass} ${cls} ${sizeClass}`;

  // 3. منطق المتوفيين (تحديد الحالة بدقة)
  let mourningLabel = "";
  if (m.isDeceased) {
    const status = getDeceasedStatus(m.deathDate);
    // الحالة: active-mourning (أسود) أو is-deceased (فضي)
    const deceasedClass = status === "normal" ? "is-deceased" : status;

    finalClasses += ` ${deceasedClass}`; // إضافة كلاس الوفاة للقائمة

    if (deceasedClass === "active-mourning") {
      mourningLabel = getMourningLabelText(m.deathDate);
      card.setAttribute("data-mourning-label", mourningLabel);
    }
  }

  // 4. منطق أعياد الميلاد (يضاف فقط للأحياء)
  // التصحيح: نتأكد أنه لا يمسح الكلاسات السابقة
  if (!m.isDeceased && isBirthdayToday(m.dob)) {
    finalClasses += " is-birthday";

    // === [تعديل] حلقة تكرار لا نهائية للكارت ===
    const startInfiniteConfetti = () => {
      // نتأكد أولاً أن الكارت لسه موجود في الصفحة عشان منعملش خطأ
      if (document.body.contains(card)) {
        triggerCardConfetti(card);
        // تكرار العملية كل 1.5 ثانية (يمكنك تقليل الرقم لزيادة السرعة)
        setTimeout(startInfiniteConfetti, 3000);
      }
    };

    // تشغيل أول مرة بعد تأخير بسيط
    setTimeout(startInfiniteConfetti, 800);
  }

  // 5. تطبيق الكلاسات النهائية مرة واحدة
  card.className = finalClasses;
  card.id = m.id;
  card.onclick = () => window.openBio(m.id);
  card.innerHTML = `<img src="${m.img}"><div class="info"><h3>${m.name}</h3><span>${label}</span></div>`;

  div.appendChild(card);
}

/* دالة رسم الخطوط المحسنة (High Performance) */
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

// دالة مساعدة سريعة لإنشاء المسار العادي (مع أنيميشن الرسم)
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

// دالة مساعدة سريعة لإنشاء مسار الزواج (مع أنيميشن الظهور)
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

window.closeBio = () => {
  // إيقاف تكرار الطراقيع فوراً
  if (confettiInterval) {
    clearInterval(confettiInterval);
    confettiInterval = null;
  }
  closeModalSmoothly("bio-modal");
};
document.getElementById("bio-modal").style.display = "none";

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
/* دالة إظهار تأكيد الحذف المخصص */
window.deleteMember = () => {
  const overlay = document.getElementById("custom-confirm-overlay");
  overlay.style.display = "flex";

  // تعيين وظيفة زر "نعم"
  document.getElementById("confirm-yes").onclick = async () => {
    const id = document.getElementById("modal-id-display").innerText;
    try {
      await deleteDoc(doc(db, "members", id));
      window.closeCustomConfirm();
      window.closeBio();
      window.customAlert("تم الحذف بنجاح 🗑️");
    } catch (e) {
      window.customAlert("خطأ: " + e.message);
    }
  };
};

window.closeCustomConfirm = () => closeModalSmoothly("custom-confirm-overlay");

window.renderEmptyState = () => {
  document.getElementById(
    "tree-container"
  ).innerHTML = `<div class="empty-state"><button class="btn-start" onclick="window.openAddFirstMember()">➕ ابدأ بإضافة أول فرد</button></div>`;
};
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
// ميزة تبديل الوضع (Dark/Light)
window.toggleTheme = () => {
  const html = document.documentElement;
  const current = html.getAttribute("data-theme");
  const next = current === "light" ? "dark" : "light";
  html.setAttribute("data-theme", next);
  localStorage.setItem("theme", next); // لحفظ اختيارك
};

// تحميل الثيم المفضل عند فتح الصفحة
document.documentElement.setAttribute(
  "data-theme",
  localStorage.getItem("theme") || "light"
);
/* تسجيل Service Worker لتفعيل خاصية التثبيت كـ تطبيق */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => console.log("Service Worker Registered"))
      .catch((err) => console.log("Service Worker Failed", err));
  });
}
/* دالة مشاركة رابط ملف شخصي محدد */
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
/* إغلاق نتائج البحث عند الضغط في أي مكان خارج الصندوق */
window.addEventListener("click", (e) => {
  const searchWrapper = document.querySelector(".search-wrapper");
  const resultsDiv = document.getElementById("search-results");

  // إذا كان الضغط خارج حاوية البحث، نخفي النتائج
  if (!searchWrapper.contains(e.target)) {
    resultsDiv.style.display = "none";
  }
});
/* دالة فتح قسم الإضافة وتجهيز القائمة (مدمجة ونظيفة) */
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
/* دالة تفعيل وضع الوفاة (إخفاء الزر وإظهار التاريخ) */
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
/* تحديث دالة فتح البيانات (نسخة مصححة) */
window.openBio = (id) => {
  const m = window.currentMembers.find((x) => x.id === id);
  if (!m) return;

  // إخفاء الأقسام الأخرى
  window.toggleAddSection(false);
  window.toggleEditSection(false);

  const modalContent = document.querySelector("#bio-modal .modal-content");

  // 1. تنظيف الكلاسات والسمات القديمة
  modalContent.classList.remove(
    "birthday-mode",
    "mourning-mode",
    "deceased-mode"
  );
  modalContent.removeAttribute("data-mourning-label");

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
  }
  // ب) حالة عيد الميلاد (فقط إذا كان حياً)
  else if (isBirthdayToday(m.dob)) {
    modalContent.classList.add("birthday-mode");

    // تشغيل الطراقيع فوراً
    triggerCardConfetti(modalContent);

    // === [تعديل] تسريع التكرار لجعله متصلاً ===
    confettiInterval = setInterval(() => {
      // نتأكد إن المودال لسه مفتوح
      if (document.getElementById("bio-modal").style.display !== "none") {
        triggerCardConfetti(modalContent);
      } else {
        clearInterval(confettiInterval);
      }
    }, 2000); // خليناها 1200 بدلاً من 2000 عشان الدفعة الجديدة تبدأ قبل القديمة ما تختفي
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
  // (يمكنك إضافة باقي الروابط هنا)

  // أخيراً: فتح المودال
  document.getElementById("bio-modal").style.display = "flex";
};

/* دالة إظهار/إخفاء خانات السوشيال ميديا */
window.toggleSocialInputs = (type) => {
  const div = document.getElementById(`${type}-social-inputs`);
  div.style.display = div.style.display === "flex" ? "none" : "flex";
};

/* دالة إضافة صف تواصل جديد */
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

/* دالة الحفظ المصححة (بدون edit-age) */
window.saveEdit = async () => {
  const id = document.getElementById("modal-id-display").innerText;
  const m = window.currentMembers.find((x) => x.id === id);

  const name = document.getElementById("edit-name").value;
  // const age = ... (حذفنا هذا السطر)
  const dob = document.getElementById("edit-dob").value; // نقرأ تاريخ الميلاد بدلاً منه
  const isPrivate = document.getElementById("edit-hide-main").checked;
  const isDeceased = document.getElementById("edit-is-deceased").checked;
  const deathDate = document.getElementById("edit-death-date").value;
  const spouse = document.getElementById("edit-existing-spouse").value;
  let img = document.getElementById("edit-img").value;

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
    await updateDoc(doc(db, "members", id), {
      name,
      img,
      dob, // حفظ التاريخ
      isPrivate,
      isDeceased,
      deathDate,
      spouse,
      ...socialData,
    });
    window.customAlert("تم التحديث بنجاح! ✨");
    window.toggleEditSection(false);
    // تحديث الواجهة فوراً لعرض العمر الجديد
    window.openBio(id);
  } catch (e) {
    window.customAlert("خطأ: " + e.message);
  }
};
/* دالة إظهار التنبيه المخصص */
window.customAlert = (message) => {
  document.getElementById("custom-alert-message").innerText = message;
  document.getElementById("custom-alert-overlay").style.display = "flex";
};

/* دالة إغلاق التنبيه */
window.closeCustomAlert = () => closeModalSmoothly("custom-alert-overlay");

/* دالة حذف رابط الصورة وإعادة الأصل */
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
/* محرك البحث والصلة الذكي */

// 1. وظيفة البحث داخل المودال
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

/* دالة تبديل الأشخاص في الكاشف */
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
/* دالة الانتقال الذكية - نسخة نظيفة لمنع تكرار الرسم */
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
/* دالة مساعدة لإغلاق أي مودال بنعومة */
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
/* ========================================= */
/* ميزة تصدير الشجرة كصورة (Using dom-to-image) */
/* ========================================= */

// دالة تحميل مكتبة dom-to-image
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
/* ========================================= */
/* لوحة الإحصائيات المطورة (Advanced Dashboard) */
/* ========================================= */

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
// في ملف script.js - استبدل دالة calculateAgeFromDOB بالكامل

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
    return days === 0 ? "مولود اليوم" : `${days} يوم`;
  }
}
/* تفعيل التاريخ بالشكل الجديد */
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
/* ========================================= */
/* مميزات تحليل تاريخ الميلاد (Analytics) */
/* ========================================= */

// 1. حساب البرج الفلكي
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

// 2. تحليل الجيل (بمسميات "رايقة" ومصرية)
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

// في ملف script.js - استبدل دالة getNextBirthdayCountdown بالكامل

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
/* ========================================= */
/* منطق الاحتفال بأعياد الميلاد (Birthday Logic) */
/* ========================================= */

// 1. دالة التحقق: هل تاريخ اليوم يطابق يوم وشهر الميلاد؟
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

// 2. دالة تشغيل أنيميشن الكونفيتي (المحسنة)
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
/* ========================================= */
/* نظام الدليل التفاعلي المطور (Smart Ultimate Tour) - V3 */
/* ========================================= */

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
/* 1. دالة إظهار خانة تاريخ الوفاة */
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

/* 2. دالة حساب حالة الوفاة (المنطق المصري) */
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
/* دالة لتحويل الأرقام إلى ترتيب عربي للسنوات */
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

/* دالة تحديد نص الحداد الدقيق */
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
// دالة مساعدة لحساب المدة المنقضية (للمتوفين)
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
