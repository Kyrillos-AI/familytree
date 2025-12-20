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
};

onSnapshot(collection(db, "members"), (snapshot) => {
  const members = [];
  snapshot.forEach((doc) => members.push({ id: doc.id, ...doc.data() }));
  window.currentMembers = members;
  refreshUI();
});

function refreshUI() {
  if (!window.currentMembers || window.currentMembers.length === 0) {
    renderEmptyState();
    return;
  }
  if (viewMode === "full") renderFullTree(window.currentMembers);
  else renderPerspectiveTree(currentFocusId, window.currentMembers);
  fitTreeToScreen();
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

/* تحديث دالة البحث للتحكم في ظهور واختفاء القائمة */
window.searchMember = () => {
  const val = document.getElementById("search-input").value.toLowerCase();
  const resDiv = document.getElementById("search-results");
  resDiv.innerHTML = "";

  // إخفاء القائمة إذا كان المربع فارغاً
  if (!val) {
    resDiv.style.display = "none";
    return;
  }

  const matches = window.currentMembers.filter((m) =>
    m.name.toLowerCase().includes(val)
  );

  if (matches.length > 0) {
    resDiv.style.display = "block"; // إظهار القائمة عند وجود نتائج
    matches.forEach((m) => {
      const d = document.createElement("div");
      d.className = "search-item";
      d.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
          <img src="${m.img}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;">
          <span>${m.name}</span>
        </div>
      `;
      d.onclick = () => {
        currentFocusId = m.id;
        viewMode = "perspective";
        refreshUI();
        document.getElementById("search-input").value = "";
        resDiv.style.display = "none"; // إغلاق القائمة بعد الاختيار
      };
      resDiv.appendChild(d);
    });
  } else {
    resDiv.style.display = "none"; // إخفاء القائمة في حال عدم وجود تطابق
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

window.saveEdit = async () => {
  const id = document.getElementById("modal-id-display").innerText;
  const name = document.getElementById("edit-name").value;
  const img = document.getElementById("edit-img").value;
  if (!name) return alert("الاسم مطلوب");
  try {
    await updateDoc(doc(db, "members", id), { name, img });
    alert("تم التعديل!");
    window.toggleEditSection(false);
  } catch (e) {
    alert(e.message);
  }
};

window.addNewRelative = async () => {
  const focusId = document.getElementById("modal-id-display").innerText;
  const name = document.getElementById("new-name").value;
  const gender = document.getElementById("new-gender").value;
  const type = document.getElementById("relation-type").value;
  const manualPrivate = document.getElementById("hide-from-main").checked;
  const focusPerson = window.currentMembers.find((m) => m.id === focusId);
  const defaultImg =
    gender === "female"
      ? "data:image/jpeg;base64,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"
      : "data:image/png;base64,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";
  if (!name) return alert("الاسم مطلوب");
  try {
    let newData = {
      name,
      gender,
      img: defaultImg,
      isPrivate: manualPrivate,
    };
    if (focusId && focusPerson) {
      const lvl = parseInt(focusPerson.level) || 1;
      if (focusPerson.isPrivate || type === "spouse") newData.isPrivate = true;
      if (type === "child") {
        newData.parent = focusId;
        newData.level = lvl + 1;
        if (focusPerson.gender === "female") newData.isPrivate = true;
      } else if (type === "parent") {
        const newDoc = await addDoc(collection(db, "members"), {
          ...newData,
          level: lvl - 1,
        });
        await updateDoc(doc(db, "members", focusId), { parent: newDoc.id });
        return window.closeBio();
      } else if (type === "spouse") {
        newData.spouse = focusId;
        newData.level = lvl;
      } else if (type === "sibling") {
        newData.parent = focusPerson.parent || null;
        newData.level = lvl;
        if (focusPerson.isPrivate) newData.isPrivate = true;
      }
    } else {
      newData.level = 1;
    }
    await addDoc(collection(db, "members"), newData);
    window.closeBio();
  } catch (e) {
    alert(e.message);
  }
};

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

/* إصلاح رسم الخطوط بدقة وحماية التدرج اللوني */
function drawLines(members) {
  const svg = document.getElementById("tree-svg");
  if (!svg) return;

  // طلب الرسم في الفريم التالي لضمان استقرار الإحداثيات
  requestAnimationFrame(() => {
    const svgR = svg.getBoundingClientRect();

    // مسح المسارات (paths) والخطوط (lines) فقط دون حذف الـ <defs>
    const oldPaths = svg.querySelectorAll("path, line");
    oldPaths.forEach((p) => p.remove());

    members.forEach((m) => {
      if (m.parent) {
        const p = document.getElementById(m.parent);
        const c = document.getElementById(m.id);
        if (p && c) drawCurve(p, c, svgR);
      }
      if (m.spouse) {
        const s = document.getElementById(m.spouse);
        const mEl = document.getElementById(m.id);
        if (s && mEl) drawSpouseLine(s, mEl, svgR);
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
  path.setAttribute("stroke", "rgba(99, 102, 241, 0.6)");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke-width", "3");
  document.getElementById("tree-svg").appendChild(path);
}
function drawSpouseLine(e1, e2, svgR) {
  const r1 = e1.getBoundingClientRect();
  const r2 = e2.getBoundingClientRect();
  const x1 = r1.left + r1.width / 2 - svgR.left;
  const y1 = r1.top + r1.height / 2 - svgR.top;
  const x2 = r2.left + r2.width / 2 - svgR.left;
  const y2 = r2.top + r2.height / 2 - svgR.top;
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", x1);
  line.setAttribute("y1", y1);
  line.setAttribute("x2", x2);
  line.setAttribute("y2", y2);
  line.setAttribute("stroke", "#ff4757");
  line.setAttribute("stroke-width", "2");
  line.setAttribute("stroke-dasharray", "5,5");
  document.getElementById("tree-svg").appendChild(line);
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

window.openBio = (id) => {
  const m = window.currentMembers.find((x) => x.id === id);
  if (m) {
    window.toggleAddSection(false);
    window.toggleEditSection(false);
    document.getElementById("modal-name").innerText = m.name;
    document.getElementById("modal-id-display").innerText = id;
    document.getElementById("modal-img").src = m.img;
    document.getElementById("target-parent-name").innerText = m.name;
    document.getElementById("bio-modal").style.display = "flex";
  }
};
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
window.deleteMember = async () => {
  if (confirm("حذف؟")) {
    await deleteDoc(
      doc(db, "members", document.getElementById("modal-id-display").innerText)
    );
    window.closeBio();
  }
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
        title: `شجرة العائلة - ${m.name}`,
        text: `شاهد الملف الشخصي لـ ${m.name} في شجرة العائلة`,
        url: shareUrl,
      })
      .catch(console.error);
  } else {
    // نسخ الرابط للكلبورد في حال كان المتصفح لا يدعم المشاركة (مثل الكمبيوتر)
    navigator.clipboard.writeText(shareUrl);
    alert("تم نسخ رابط الملف الشخصي لـ " + m.name);
  }
};
/* ميزة سحب وتحريك الشجرة - للجوال فقط (شاشات أقل من 768 بكسل) */
if (window.innerWidth < 768) {
  const wrapper = document.querySelector(".tree-wrapper");
  let isDown = false;
  let startX;
  let startY;
  let scrollLeft;
  let scrollTop;

  // دعم اللمس للجوال فقط
  wrapper.addEventListener(
    "touchstart",
    (e) => {
      isDown = true;
      startX = e.touches[0].pageX - wrapper.offsetLeft;
      startY = e.touches[0].pageY - wrapper.offsetTop;
      scrollLeft = wrapper.scrollLeft;
      scrollTop = wrapper.scrollTop;
    },
    { passive: true }
  );

  wrapper.addEventListener("touchend", () => (isDown = false));

  wrapper.addEventListener(
    "touchmove",
    (e) => {
      if (!isDown) return;
      const x = e.touches[0].pageX - wrapper.offsetLeft;
      const y = e.touches[0].pageY - wrapper.offsetTop;
      // تحريك الحاوية بناءً على حركة الإصبع
      wrapper.scrollLeft = scrollLeft - (x - startX);
      wrapper.scrollTop = scrollTop - (y - startY);
    },
    { passive: true }
  );
}
