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
//

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

onSnapshot(collection(db, "members"), (snapshot) => {
  const members = [];
  snapshot.forEach((doc) => members.push({ id: doc.id, ...doc.data() }));
  window.currentMembers = members;
  refreshUI();
  /* تأكد من وجود هذه المتغيرات في بداية الملف */
  let isFirstLoad = true;

  /* داخل دالة مراقبة البيانات */
  onSnapshot(collection(db, "members"), (snapshot) => {
    // ... كود جلب البيانات الخاص بك ...

    refreshUI();

    // هذا هو الجزء المسؤول عن إخفاء اللودر
    if (isFirstLoad) {
      const lw = document.getElementById("loader-wrapper");
      if (lw) {
        setTimeout(() => {
          lw.style.opacity = "0";
          lw.style.transform = "scale(1.1)";
          setTimeout(() => lw.remove(), 500); // حذفه تماماً بعد ثانية من التلاشي
        }, 3500); // وقت شحن الشريط
      }
      isFirstLoad = false;
    }
  });
});

/* تحديث الواجهة وضمان رسم الخطوط بدقة */
function refreshUI() {
  if (!window.currentMembers || window.currentMembers.length === 0) {
    renderEmptyState();
    return;
  }

  if (viewMode === "full") renderFullTree(window.currentMembers);
  else renderPerspectiveTree(currentFocusId, window.currentMembers);

  fitTreeToScreen();

  // استدعاء رسم الخطوط مرتين لضمان الدقة بعد ضبط المقاسات
  requestAnimationFrame(() => {
    drawLines(window.currentMembers);
  });
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
  setTimeout(() => drawLines(bloodline), 500);
}

function renderPerspectiveTree(focusId, allMembers) {
  viewMode = "perspective";
  const container = document.getElementById("tree-container");
  const svg = document.getElementById("tree-svg");
  container.innerHTML = "";
  svg.innerHTML = "";
  const person = allMembers.find((m) => m.id === focusId);
  if (!person) return window.showFullTree();

  const spouses = allMembers.filter(
    (m) => m.id === person.spouse || m.spouse === focusId
  );
  const spouseIds = spouses.map((s) => s.id);
  const children = allMembers.filter(
    (m) => m.parent === focusId || spouseIds.includes(m.parent)
  );
  const father = person.parent
    ? allMembers.find((m) => m.id === person.parent)
    : null;
  const grandfather =
    father && father.parent
      ? allMembers.find((m) => m.id === father.parent)
      : null;
  const uncles =
    father && father.parent
      ? allMembers.filter(
          (m) => m.parent === father.parent && m.id !== father.id
        )
      : [];
  /* كود البحث عن الأم والأخوال */
  // 1. البحث عن الأم (زوجة الأب)
  const mother = father
    ? allMembers.find((m) => m.id === father.spouse || m.spouse === father.id)
    : null;

  // 2. البحث عن الأخوال والخالات (أشقاء الأم)
  const maternalUncles =
    mother && mother.parent
      ? allMembers.filter(
          (m) => m.parent === mother.parent && m.id !== mother.id
        )
      : [];
  const siblings = person.parent
    ? allMembers.filter(
        (m) =>
          m.parent === person.parent &&
          m.id !== focusId &&
          !spouseIds.includes(m.id)
      )
    : [];

  container.innerHTML = `
    <div class="level section-label" data-label="الأجداد"><div id="g-row" class="level"></div></div>
    <div class="level section-label" data-label="الأب والأعمام"><div id="p-row" class="level"></div></div>
    <div class="level section-label" data-label="أنت والإخوة"><div id="m-row" class="level">
        <div id="siblings-group" class="level-group"></div>
        <div id="main-couple" class="couple-wrapper"></div>
    </div></div>
    <div class="level section-label" data-label="الأبناء"><div id="c-row" class="level"></div></div>
  `;
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
      relationNames.uncle_aunt[u.gender] // سيختار "عمي" للذكر و "عمتي" للأنثى تلقائياً
    )
  );
  /* كود إظهار كروت الأخوال في صف الأقارب */
  maternalUncles.forEach((mu) =>
    createCardIn(
      document.getElementById("p-row"),
      mu,
      relationNames.maternal_sibling
        ? relationNames.maternal_sibling[mu.gender]
        : "خالي/خالتي"
    )
  );
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
  setTimeout(() => drawLines(allMembers), 500);
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
      // البحث عن بيانات الأب باستخدام الـ ID المخزن في حقل parent
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
        currentFocusId = m.id;
        viewMode = "perspective";
        refreshUI();
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
    document.getElementById("edit-target-name").innerText = m.name;
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
  const age = document.getElementById("new-age").value;
  const gender = document.getElementById("new-gender").value;
  const isPrivate = document.getElementById("new-hide-main").checked;
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
        age,
        gender,
        isPrivate,
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
  // إضافة كلاس اللون بناءً على الجنس
  const genderClass = m.gender === "female" ? "female-card" : "male-card";
  card.className = `member-card ${genderClass} ${cls} ${
    m.level > 2 ? "card-small" : ""
  }`;
  card.id = m.id;
  card.onclick = () => window.openBio(m.id);
  card.innerHTML = `<img src="${m.img}"><div class="info"><h3>${m.name}</h3><span>${label}</span></div>`;
  div.appendChild(card);
}

/* تعديل رسم الخطوط لإظهار صلة الزواج في المنظور الشخصي فقط */
function drawLines(members) {
  const svg = document.getElementById("tree-svg");
  if (!svg) return;

  requestAnimationFrame(() => {
    const svgR = svg.getBoundingClientRect();
    const oldPaths = svg.querySelectorAll("path, line");
    oldPaths.forEach((p) => p.remove());

    members.forEach((m) => {
      // رسم خطوط الأبناء (دائماً تظهر)
      if (m.parent) {
        const p = document.getElementById(m.parent);
        const c = document.getElementById(m.id);
        if (p && c) drawCurve(p, c, svgR);
      }

      // رسم خط الزواج في وضع المنظور الشخصي فقط وبشكل منحني
      if (viewMode === "perspective" && m.spouse) {
        const p1 = document.getElementById(m.id);
        const p2 = document.getElementById(m.spouse);
        if (p1 && p2) drawSpouseLine(p1, p2, svgR);
      }
    });
  });
}
function drawCurve(p, c, svgR) {
  const r1 = p.getBoundingClientRect();
  const r2 = c.getBoundingClientRect();

  // حساب الإحداثيات بدقة بناءً على موقع الـ SVG الحالي
  const x1 = r1.left + r1.width / 2 - svgR.left;
  const y1 = r1.bottom - svgR.top;
  const x2 = r2.left + r2.width / 2 - svgR.left;
  const y2 = r2.top - svgR.top;

  const midY = (y1 + y2) / 2;
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`
  );

  // تفعيل التدرج اللوني الموجود في index.html
  path.setAttribute("stroke", "var(--text-main)");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke-width", "3");
  document.getElementById("tree-svg").appendChild(path);
}
/* تحسين شكل القوس الرابط بين الزوجين */
function drawSpouseLine(e1, e2, svgR) {
  const r1 = e1.getBoundingClientRect();
  const r2 = e2.getBoundingClientRect();

  const x1 = r1.left + r1.width / 2 - svgR.left;
  const y1 = r1.top + r1.height / 2 - svgR.top;
  const x2 = r2.left + r2.width / 2 - svgR.left;
  const y2 = r2.top + r2.height / 2 - svgR.top;

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

  // حساب نقطة تحكم تجعل المنحنى يرتفع للأعلى قليلاً ثم ينخفض
  const midX = (x1 + x2) / 2;
  const controlY = Math.min(y1, y2) - 50;

  path.setAttribute("d", `M ${x1} ${y1} Q ${midX} ${controlY} ${x2} ${y2}`);
  path.setAttribute("stroke", "var(--text-main)"); // استخدام لون التوهج الثاني
  path.setAttribute("fill", "none");
  path.setAttribute("stroke-width", "2.5");
  path.setAttribute("stroke-dasharray", "10,5"); // جعل الخط منقطاً بشكل أنيق

  document.getElementById("tree-svg").appendChild(path);
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

window.closeBio = () =>
  (document.getElementById("bio-modal").style.display = "none");
window.toggleAddSection = (s) => {
  document.getElementById("add-section").style.display = s ? "block" : "none";
  document.getElementById("view-section").style.display = s ? "none" : "block";
};
window.switchProfile = () => {
  currentFocusId = document.getElementById("modal-id-display").innerText;
  viewMode = "perspective";
  refreshUI();
  window.closeBio();
};
window.showFullTree = () => {
  viewMode = "full";
  refreshUI();
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

window.closeCustomConfirm = () => {
  document.getElementById("custom-confirm-overlay").style.display = "none";
};
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
/* تعبئة قائمة الأعضاء عند فتح قسم الإضافة */
const originalToggleAdd = window.toggleAddSection;
window.toggleAddSection = (s) => {
  if (s) {
    const select = document.getElementById("new-existing-member");
    const focusId = document.getElementById("modal-id-display").innerText;
    select.innerHTML =
      '<option value="">-- أو اختر شخص موجود للربط --</option>';

    window.currentMembers.forEach((m) => {
      if (m.id !== focusId) {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.text = m.name;
        select.add(opt);
      }
    });
  }
  originalToggleAdd(s);
};
/* تحديث دالة فتح البيانات لجلب السوشيال ميديا للتعديل */
window.openBio = (id) => {
  const m = window.currentMembers.find((x) => x.id === id);
  if (!m) return;

  window.toggleAddSection(false);
  window.toggleEditSection(false);

  document.getElementById("modal-name").innerText = m.name;
  document.getElementById("modal-id-display").innerText = id;
  document.getElementById("modal-img").src = m.img;

  // إظهار اسم الأب والسن
  const parent = window.currentMembers.find((p) => p.id === m.parent);
  document.getElementById("modal-father").innerText = parent
    ? `(${parent.name})`
    : "";
  document.getElementById("modal-age").innerText = m.age ? ` ${m.age} سنة` : "";

  // تعبئة خانات التعديل
  document.getElementById("edit-name").value = m.name || "";
  document.getElementById("edit-age").value = m.age || "";
  document.getElementById("edit-img").value = m.img || "";

  // --- الجزء الهام: جلب السوشيال ميديا لقائمة التعديل لكي تظهر عند الفتح ---
  const editSocialContainer = document.getElementById("edit-social-list");
  editSocialContainer.innerHTML = ""; // مسح القائمة الحالية
  const platforms = ["wa", "fb", "inst", "tt", "tg", "phone"];
  platforms.forEach((p) => {
    if (m[p]) {
      // استدعاء دالة إضافة صف تواصل وتعبئتها بالبيانات الموجودة فعلياً
      window.addSocialRow("edit", p, m[p]);
    }
  });

  // تحديث قائمة السوشيال في قسم العرض (الأيقونات)
  const menu = document.querySelector(".social-menu");
  menu.innerHTML = "";
  if (m.fb) menu.innerHTML += `<a href="${m.fb}" target="_blank">Facebook</a>`;
  if (m.wa)
    menu.innerHTML += `<a href="https://wa.me/${m.wa}" target="_blank">WhatsApp</a>`;
  // ... باقي روابط السوشيال في العرض ...

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

/* دالة الحفظ المصححة لضمان حذف الصورة فعلياً */
window.saveEdit = async () => {
  const id = document.getElementById("modal-id-display").innerText;
  const m = window.currentMembers.find((x) => x.id === id);

  const name = document.getElementById("edit-name").value;
  const age = document.getElementById("edit-age").value;
  const isPrivate = document.getElementById("edit-hide-main").checked;
  const spouse = document.getElementById("edit-existing-spouse").value;
  let img = document.getElementById("edit-img").value;

  // إذا كانت الخانة فارغة، نضع الصورة الافتراضية بناءً على الجنس
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
      age,
      isPrivate,
      spouse,
      ...socialData,
    });
    window.customAlert("تم التحديث بنجاح! ✨");
    window.toggleEditSection(false);
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
window.closeCustomAlert = () => {
  document.getElementById("custom-alert-overlay").style.display = "none";
};
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

/* محرك حساب صلة القرابة المطور بدعم كامل لجنس الطرفين */
window.calculateRelationship = () => {
  const id1 = document.getElementById("id-person-a").value; // الشخص الأول (الأساس/المنسوب إليه)
  const id2 = document.getElementById("id-person-b").value; // الشخص الثاني (الهدف/المراد معرفة صلته)
  const members = window.currentMembers;

  if (!id1 || !id2) return window.customAlert("اختار شخصين من البحث ⚠️");
  if (id1 === id2) return window.customAlert("يعم دا نفس الشخص 😂");

  const p1 = members.find((m) => m.id === id1);
  const p2 = members.find((m) => m.id === id2);

  // تحديد جنس الطرفين لضبط المسميات والضمائر
  const isF2 = p2.gender === "female"; // جنس الشخص الثاني (أخ أم أخت)
  const suffix = p1.gender === "female" ? "ها" : "ه"; // الضمير العائد على الشخص الأول (أخوه أم أخوها)

  const getPath = (id) => {
    let path = [];
    let curr = members.find((m) => m.id === id);
    while (curr) {
      path.push(curr.id);
      curr = members.find((m) => m.id === curr.parent);
    }
    return path;
  };

  const path1 = getPath(id1);
  const path2 = getPath(id2);
  let lcaId = path1.find((id) => path2.includes(id));
  let lca = members.find((m) => m.id === lcaId);

  let d1 = path1.indexOf(lcaId);
  let d2 = path2.indexOf(lcaId);

  let rel = "مفيش صلة قرابه مباشرة";

  if (lca) {
    // صلات القرابة المباشرة مع معالجة الضمائر والجنس
    if (d1 === 1 && d2 === 0) rel = isF2 ? "أم" + suffix : "أبو" + suffix;
    else if (d1 === 0 && d2 === 1) rel = isF2 ? "بنت" + suffix : "ابن" + suffix;
    else if (d1 === 1 && d2 === 1) rel = isF2 ? "أخت" + suffix : "أخو" + suffix;
    else if (d1 === 2 && d2 === 0) rel = isF2 ? "جدت" + suffix : "جد" + suffix;
    else if (d1 === 0 && d2 === 2)
      rel = isF2 ? "حفيدت" + suffix : "حفيد" + suffix;
    // الأعمام والأخوال
    else if (d1 === 2 && d2 === 1) {
      const parentOfP1 = members.find((m) => m.id === p1.parent);
      if (parentOfP1?.gender === "male")
        rel = isF2 ? "عمت" + suffix : "عم" + suffix;
      else rel = isF2 ? "خالت" + suffix : "خال" + suffix;
    }

    // أبناء الإخوة (تحديد ابن/بنت + أخوه/أختها بدقة)
    else if (d1 === 1 && d2 === 2) {
      const parentOfP2 = members.find((m) => m.id === path2[1]); // والد الشخص الثاني (أخو/أخت الأول)
      const prefix = isF2 ? "بنت " : "ابن ";
      const siblingTitle = parentOfP2?.gender === "male" ? "أخو" : "أخت";
      rel = prefix + siblingTitle + suffix;
    }

    // أبناء الأعمام والأخوال
    else if (d1 === 2 && d2 === 2) {
      const p1Parent = members.find((m) => m.id === path1[1]); // والد الشخص الأول
      const p2Parent = members.find((m) => m.id === path2[1]); // والد الشخص الثاني
      const prefix = isF2 ? "بنت " : "ابن ";

      if (p1Parent?.gender === "male") {
        const title = p2Parent?.gender === "male" ? "عم" : "عمت";
        rel = prefix + title + suffix;
      } else {
        const title = p2Parent?.gender === "male" ? "خال" : "خالت";
        rel = prefix + title + suffix;
      }
    } else rel = `قريب من الدرجة (${d1 + d2})`;
  }

  // صلة المصاهرة (الزواج)
  if (!lca && (p1.spouse === id2 || p2.spouse === id1)) {
    rel = isF2 ? "مرات" + suffix : "جوز" + suffix;
  }

  document.getElementById("rel-result-text").innerText = rel;
  document.getElementById("rel-result-box").style.display = "block";
};
window.openRelCalc = () => {
  document.getElementById("rel-calc-modal").style.display = "flex";
  document.getElementById("rel-result-box").style.display = "none";
  document.getElementById("input-person-a").value = "";
  document.getElementById("input-person-b").value = "";
};
