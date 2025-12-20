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

const relationNames = {
  child: { male: "ابن", female: "ابنة" },
  sibling: { male: "أخ", female: "أخت" },
  parent: { male: "أب", female: "أم" },
  spouse: { male: "زوج", female: "زوجة" },
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
    createCardIn(document.getElementById("g-row"), grandfather, "الجد");
  if (father)
    createCardIn(
      document.getElementById("p-row"),
      father,
      relationNames.parent[father.gender] || "والد"
    );
  uncles.forEach((u) =>
    createCardIn(document.getElementById("p-row"), u, "عم/عمة")
  );
  createCardIn(
    document.getElementById("main-couple"),
    person,
    "أنت",
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

// ميزة البحث المطور للنافبار الجديد
window.searchMember = () => {
  const val = document.getElementById("search-input").value.toLowerCase();
  const resDiv = document.getElementById("search-results");
  resDiv.innerHTML = "";
  if (!val) return;

  const matches = window.currentMembers.filter((m) =>
    m.name.toLowerCase().includes(val)
  );

  matches.forEach((m) => {
    const d = document.createElement("div");
    d.className = "search-item";
    d.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <img src="${m.img}" style="width:30px; height:30px; border-radius:50%;">
        <span>${m.name}</span>
      </div>
    `;
    d.onclick = () => {
      currentFocusId = m.id;
      viewMode = "perspective";
      refreshUI();
      document.getElementById("search-input").value = "";
      resDiv.innerHTML = "";
    };
    resDiv.appendChild(d);
  });
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
  if (!name) return alert("الاسم مطلوب");
  try {
    let newData = {
      name,
      gender,
      img: `https://i.pravatar.cc/150?u=${name}`,
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

function drawLines(members) {
  const svg = document.getElementById("tree-svg");
  const svgR = svg.getBoundingClientRect();
  svg.innerHTML = "";
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
}

function drawCurve(p, c, svgR) {
  const r1 = p.getBoundingClientRect();
  const r2 = c.getBoundingClientRect();
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
  path.setAttribute("stroke", "rgba(99, 102, 241, 0.6)");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke-width", "2.5");
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
