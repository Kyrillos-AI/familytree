/* ==========================================================================
   WASLAA FAMILY TREE - SCRIPT V3.0
   ==========================================================================
   PART 1: Core Systems
   - Firebase Initialization
   - Global State Management
   - Core Managers (Authentication, Database)
   - Advanced Relationship Engine
   - Notification Manager
   ========================================================================== */

/* ==========================================================================
   1. FIREBASE INITIALIZATION & CONFIGURATION
   ========================================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc,
  updateDoc, getDoc, setDoc, query, where, getDocs, writeBatch,
  orderBy, limit, collectionGroup, deleteField
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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


/* ==========================================================================
   2. GLOBAL VARIABLES & STATE MANAGEMENT
   ========================================================================== */
window.currentMembers = [];
let currentUser = null;
let currentTreeId = null;
let membersUnsubscribe = null;
let chatUnsubscribe = null;
let privateChatUnsubscribe = null;
let currentFocusId = null;
let currentChatRoomId = null;
let alertTimeout;

let viewMode = "full";
let navHistory = [];
let isFirstLoad = true;
window.showMaternal = false;
window.isTreeOwner = false;
window.canAdd = false;
window.canEdit = false;
window.canDelete = false;
window.currentUserLinkedMemberId = null;
window.treeCreatorId = null;
let currentEmojiInput = null;


/* ==========================================================================
   3. NOTIFICATION MANAGER (SELF-HEALING & AUTO-CLOSING)
   ========================================================================== */

/**
 * Displays a custom, non-blocking alert that auto-closes.
 * If the alert DOM element doesn't exist, it creates it.
 * @param {string} message The message to display.
 * @param {'info' | 'success' | 'warning' | 'error'} type The type of the alert.
 * @param {number} [duration=4000] The duration in milliseconds before auto-closing.
 */
window.customAlert = (message, type = "info", duration = 4000) => {
  clearTimeout(alertTimeout);

  let overlay = document.getElementById("google-alert-overlay");
  if (!overlay) {
    const modalHTML = `
      <div id="google-alert-overlay" class="alert-overlay" style="display: none;">
        <div class="custom-alert glass" style="border-top: 4px solid var(--primary-glow)">
          <div class="alert-icon" id="google-alert-icon">🔔</div>
          <p id="google-alert-message" style="font-weight: bold; font-size: 1rem"></p>
          <button class="btn-confirm" onclick="window.closeGoogleAlert()" style="width: 100%; margin-top: 10px">
            حسناً
          </button>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    overlay = document.getElementById("google-alert-overlay");
  }

  const msgEl = document.getElementById("google-alert-message");
  const iconEl = document.getElementById("google-alert-icon");
  const alertBox = overlay.querySelector('.custom-alert');
  const closeBtn = overlay.querySelector('.btn-confirm');

  if (msgEl && iconEl && alertBox && closeBtn) {
    msgEl.innerText = message;
    let icon = "ℹ️";
    let color = "var(--primary-glow)";
    if (type === "success") { icon = "✅"; color = "#10b981"; }
    if (type === "warning") { icon = "⚠️"; color = "#f59e0b"; }
    if (type === "error") { icon = "❌"; color = "#ff4757"; }

    iconEl.innerText = icon;
    alertBox.style.borderTopColor = color;
    closeBtn.style.backgroundColor = color;

    overlay.style.display = "flex";
    alertBox.style.animation = "none";
    void alertBox.offsetWidth; // Trigger reflow to restart animation
    alertBox.style.animation = "contentPopIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)";

    alertTimeout = setTimeout(() => {
      window.closeGoogleAlert();
    }, duration);
  } else {
    alert(message);
  }
};

/**
 * Closes the custom alert modal smoothly.
 */
window.closeGoogleAlert = () => {
  clearTimeout(alertTimeout);
  window.closeModalSmoothly("google-alert-overlay");
};


/* ==========================================================================
   4. AUTHENTICATION & DATABASE MANAGERS
   ========================================================================== */

/**
 * Signs out the current user and redirects to the login page.
 */
window.performLogout = async () => {
  try {
    await signOut(auth);
    window.currentMembers = [];
    window.currentUser = null;
    window.location.href = "index.html";
  } catch (error) {
    window.customAlert("حدث خطأ أثناء تسجيل الخروج: " + error.message, "error");
  }
};

/**
 * Loads and listens for real-time updates for a specific tree's members.
 * This is the primary data entry point for the application.
 * @param {string} treeId The ID of the tree to load.
 */
function loadTreeData(treeId) {
  const container = document.getElementById("tree-container");
  if (container) container.innerHTML = "";
  window.currentMembers = [];

  const mainWrapper = document.querySelector(".main-wrapper");
  if (mainWrapper) mainWrapper.style.display = "block";

  if (membersUnsubscribe) membersUnsubscribe();

  const membersRef = collection(db, "trees", treeId, "members");
  membersUnsubscribe = onSnapshot(
    membersRef,
    (snapshot) => {
      window.currentMembers = [];
      snapshot.docs.forEach((doc) => {
        window.currentMembers.push({ ...doc.data(), id: doc.id });
      });
      fetchUserAndTreeMetadata(treeId);
    },
    (error) => {
      document.getElementById("loader-wrapper").style.display = "none";
      window.customAlert("حدث خطأ أثناء تحميل بيانات الشجرة. قد تكون الصلاحيات غير كافية.", "error");
    }
  );
}

/**
 * Fetches metadata about the tree (like owner) and the current user's link to it.
 * This function also handles setting admin permissions.
 * @param {string} treeId The ID of the tree.
 */
async function fetchUserAndTreeMetadata(treeId) {
  try {
    const treeDocRef = doc(db, "trees", treeId);
    const userDocRef = doc(db, "users", currentUser.uid);

    const [treeSnap, userSnap] = await Promise.all([
      getDoc(treeDocRef),
      getDoc(userDocRef),
    ]);

    if (treeSnap.exists()) {
      const treeData = treeSnap.data();
      window.treeCreatorId = treeData.creatorId;
      window.isTreeOwner = treeData.ownerId === currentUser.uid;
      const permsMap = treeData.adminPermissions || {};
      const myPerms = permsMap[currentUser.uid] || [];
      
      window.canAdd = window.isTreeOwner || myPerms.includes("add");
      window.canEdit = window.isTreeOwner || myPerms.includes("edit");
      window.canDelete = window.isTreeOwner || myPerms.includes("delete");

      const settingsBtn = document.getElementById("settings-btn");
      if (settingsBtn) {
          settingsBtn.style.display = window.isTreeOwner ? "flex" : "none";
      }
    }

    if (userSnap.exists()) {
      window.currentUserLinkedMemberId = userSnap.data().linkedMemberId;
    }

    refreshUI(); // Now that all data is ready, render the UI.
    document.getElementById("loader-wrapper").style.display = "none";
  } catch (error) {
    document.getElementById("loader-wrapper").style.display = "none";
    window.customAlert("فشل تحميل بيانات المستخدم/الشجرة: " + error.message, "error");
  }
}


/* ==========================================================================
   5. ADVANCED RELATIONSHIP ENGINE (LCA ALGORITHM)
   ========================================================================== */

/**
 * Calculates and displays the relationship between two selected members using a
 * multi-path Lowest Common Ancestor (LCA) algorithm.
 */
window.calculateRelationship = () => {
  const id1 = document.getElementById("id-person-a")?.value;
  const id2 = document.getElementById("id-person-b")?.value;
  const members = window.currentMembers;

  if (!id1 || !id2) return window.customAlert("الرجاء اختيار شخصين.", "warning");
  if (id1 === id2) return window.customAlert("لا يمكن حساب القرابة مع نفس الشخص.", "warning");

  const p1 = members.find((m) => m.id === id1);
  const p2 = members.find((m) => m.id === id2);

  if (!p1 || !p2) return window.customAlert("خطأ: لم يتم العثور على أحد الأشخاص.", "error");

  const isTargetFemale = p2.gender === "female";
  const suffix = p1.gender === "female" ? "ها" : "ه";

  const getMother = (person) => {
    if (!person || !person.parent) return null;
    const father = members.find((m) => m.id === person.parent);
    if (!father) return null;
    return members.find((m) => m.id === father.spouse || m.spouse === father.id);
  };

  const p1Mother = getMother(p1);
  const p2Mother = getMother(p2);

  if (p1.parent === id2) return showResult("أبو" + suffix);
  if (p1Mother && p1Mother.id === id2) return showResult(isTargetFemale ? "أم" + suffix : "زوجة أب" + suffix);
  if (p2.parent === id1) return showResult(isTargetFemale ? "بنت" + suffix : "ابن" + suffix);
  if (p2Mother && p2Mother.id === id1) return showResult(isTargetFemale ? "بنت" + suffix : "ابن" + suffix);

  const getPath = (id) => {
    let path = [];
    let current = members.find((m) => m.id === id);
    while (current) {
      path.push(current.id);
      current = members.find((m) => m.id === current.parent);
    }
    return path;
  };

  const path1F = getPath(id1);
  const path1M = p1Mother ? getPath(p1Mother.id) : [];
  const path2F = getPath(id2);
  const path2M = p2Mother ? getPath(p2Mother.id) : [];

  const checkIntersection = (pathA, pathB, offsetA, offsetB) => {
    const lcaId = pathA.find((id) => pathB.includes(id));
    if (lcaId) {
      return {
        d1: pathA.indexOf(lcaId) + offsetA,
        d2: pathB.indexOf(lcaId) + offsetB,
        mySide: offsetA === 0 ? "father" : "mother",
        targetSide: offsetB === 0 ? "father" : "mother",
      };
    }
    return null;
  };

  let result = checkIntersection(path1F, path2F, 0, 0) ||
               checkIntersection(path1F, path2M, 0, 1) ||
               checkIntersection(path1M, path2F, 1, 0) ||
               checkIntersection(path1M, path2M, 1, 1);

  if (result) {
    const { d1, d2, mySide, targetSide } = result;
    let rel = "";
    if (d1 === 1 && d2 === 1) rel = isTargetFemale ? "أخت" + suffix : "أخو" + suffix;
    else if (d1 === 2 && d2 === 1) rel = (mySide === "father") ? (isTargetFemale ? "عمة" : "عم") : (isTargetFemale ? "خالة" : "خال");
    else if (d1 === 1 && d2 === 2) rel = `ابن/بنت ال${(targetSide === "father") ? "أخ" : "أخت"}`;
    else if (d1 === 2 && d2 === 2) rel = `ابن/بنت ال${(mySide === 'father' ? (targetSide === 'father' ? 'عم' : 'عمة') : (targetSide === 'father' ? 'خال' : 'خالة'))}`;
    else if (d1 === 3 && d2 === 3) rel = "ابن/بنت ابن/بنت العم/الخال";
    else if (d1 > 1 && d2 === 0) rel = "جد/جدة";
    else if (d1 === 0 && d2 > 1) rel = "حفيد/حفيدة";
    else rel = `قريب من الدرجة (${d1}, ${d2})`;
    return showResult(rel);
  }

  // In-law logic
  const areSiblings = (pA, pB) => pA && pB && pA.parent && pA.parent === pB.parent;
  if (p1.spouse === id2 || p2.spouse === id1) return showResult(isTargetFemale ? "زوجة" : "زوج");
  const p1Spouse = members.find(m => m.id === p1.spouse);
  if (p1Spouse && areSiblings(p1Spouse, p2)) return showResult(isTargetFemale ? "أخت الزوج/ة" : "أخ الزوج/ة");
  const p2Spouse = members.find(m => m.id === p2.spouse);
  if (p2Spouse && areSiblings(p2Spouse, p1)) return showResult(isTargetFemale ? "زوجة الأخ/الأخت" : "زوج الأخت/الأخ");

  window.customAlert("لا توجد صلة قرابة دم مباشرة مسجلة.", "info");
};

/**
 * Displays the result in the calculator modal.
 * @param {string} text - The relationship text to display.
 */
function showResult(text) {
  const resultBox = document.getElementById("rel-result-box");
  const resultText = document.getElementById("rel-result-text");
  if (resultBox && resultText) {
    resultText.innerText = text;
    resultBox.style.display = "block";
  }
}
/* ==========================================================================
   6. UI MANAGER (General Interface Controls)
   ========================================================================== */

/**
 * Toggles the main navigation menu grid.
 */
window.toggleNavMenu = () => {
  document.getElementById("nav-menu-grid")?.classList.toggle("open");
  document.querySelector(".nav-toggle-btn")?.classList.toggle("active");
};

/**
 * Toggles the user profile dropdown menu.
 */
window.toggleProfileMenu = () => {
  document.getElementById("profile-dropdown")?.classList.toggle("active");
};

/**
 * Toggles the color theme between light and dark mode.
 */
window.toggleTheme = () => {
  const html = document.documentElement;
  const current = html.getAttribute("data-theme");
  const next = current === "light" ? "dark" : "light";
  html.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
};

/**
 * Navigates back in the focus history.
 */
window.goBack = () => {
  animateTransition(() => {
    if (navHistory.length > 0) {
      currentFocusId = navHistory.pop();
      viewMode = "perspective";
    } else {
      viewMode = "full";
    }
    refreshUI();
  });
};

/**
 * Smoothly closes a modal by its ID.
 * @param {string} modalId The ID of the modal to close.
 */
window.closeModalSmoothly = (modalId) => {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  const content = modal.querySelector(".modal-content, .custom-alert");
  modal.classList.add("closing-backdrop");
  if (content) content.classList.add("closing-content");

  setTimeout(() => {
    modal.style.display = "none";
    modal.classList.remove("closing-backdrop");
    if (content) content.classList.remove("closing-content");
  }, 300);
};


/* ==========================================================================
   7. BIO & PROFILE MANAGER
   ========================================================================== */

/**
 * Opens the bio modal for a specific member.
 * @param {string | null} memberId The ID of the member, or null to add the first member.
 * @param {boolean} [isFirst=false] Flag if this is the very first member.
 */
window.openBio = (memberId, isFirst = false) => {
  const modal = document.getElementById("bio-modal");
  if (!modal) return;

  const member = window.currentMembers.find((m) => m.id === memberId);

  if (!member && !isFirst) {
    return window.customAlert("لم يتم العثور على هذا العضو.", "error");
  }

  // Reset UI states
  document.body.classList.remove("admin-mode");
  document.getElementById("view-section").style.display = "block";
  document.getElementById("add-section").style.display = "none";
  document.getElementById("edit-section").style.display = "none";
  document.getElementById("occasions-manager-section").style.display = "none";

  if (isFirst) {
    document.getElementById("modal-id-display").innerText = "ROOT";
    toggleAddSection(true);
  } else {
    document.getElementById("modal-id-display").innerText = memberId;
    populateViewData(member);
    populateEditData(member);
    configureActionButtons(member);
  }

  modal.style.display = "flex";
};

/**
 * Closes the bio modal.
 */
window.closeBio = () => {
  closeModalSmoothly("bio-modal");
};

/**
 * Populates the "View" section of the bio modal with member data.
 * @param {object} member The member data object.
 */
function populateViewData(member) {
  document.getElementById("modal-name").innerText = member.name;
  document.getElementById("modal-img").src = member.img || (member.gender === 'male' ? 'mainmale.png' : 'mainfemale.png');
  
  const parent = window.currentMembers.find(p => p.id === member.parent);
  document.getElementById("modal-father").innerText = parent ? `ابن: ${parent.name}` : "مؤسس العائلة";
  
  document.getElementById("modal-age").innerText = member.dob ? calculateAgeFromDOB(member.dob) : "";

  // Badges and other info can be populated here
}

/**
 * Populates the "Edit" section of the bio modal with member data.
 * @param {object} member The member data object.
 */
function populateEditData(member) {
    document.getElementById("edit-name").value = member.name || "";
    document.getElementById("edit-img").value = member.img || "";
    document.getElementById("edit-dob").value = member.dob || "";
    document.getElementById("edit-is-deceased").checked = member.isDeceased || false;
    document.getElementById("edit-death-date").value = member.deathDate || "";
    document.getElementById("edit-hide-main").checked = member.isPrivate || false;

    // Handle deceased UI
    enableDeceasedMode('edit', member.isDeceased);
}

/**
 * Configures the visibility and text of action buttons based on user permissions.
 * @param {object} member The member data object.
 */
function configureActionButtons(member) {
  const isMyProfile = member.linkedUserId === currentUser.uid;

  const addBtn = document.querySelector(".edit-controls .action-item[onclick=\"window.toggleAddSection(true)\"]");
  const editBtn = document.querySelector(".edit-controls .action-item[onclick=\"window.toggleEditSection(true)\"]");
  const deleteBtn = document.querySelector(".edit-controls .action-item[onclick=\"window.deleteMember()\"]");
  const occasionBtn = document.querySelector(".edit-controls .action-item[onclick=\"window.openOccasionsManager()\"]");
  const adminToggleBtn = document.querySelector(".btn-mini-mode");

  if (adminToggleBtn) adminToggleBtn.style.display = (window.isTreeOwner || isMyProfile) ? "flex" : "none";
  if (addBtn) addBtn.style.display = window.canAdd ? "flex" : "none";
  if (editBtn) editBtn.style.display = (window.canEdit || isMyProfile) ? "flex" : "none";
  if (deleteBtn) deleteBtn.style.display = window.canDelete ? "flex" : "none";
  if (occasionBtn) occasionBtn.style.display = window.canEdit ? "flex" : "none";
}


/* ==========================================================================
   8. RENDERING ENGINE (TIDY TREE LAYOUT)
   ========================================================================== */

const levelHeight = 140; // Increased vertical space between generations
const siblingGap = 50;   // Increased horizontal space between siblings

/**
 * Central function to refresh the entire tree UI.
 */
function refreshUI() {
  const members = window.currentMembers;
  if (!members || members.length === 0) {
    return renderEmptyState();
  }

  const svg = document.getElementById("tree-svg");
  if (svg) svg.innerHTML = "";

  if (viewMode === "full") {
    renderFullTree(members);
  } else {
    renderPerspectiveTree(currentFocusId, members);
  }

  fitTreeToScreen();
  renderGenerationLabels();

  requestAnimationFrame(() => {
    setTimeout(() => drawLines(window.currentMembers), 500);
  });
}

/**
 * Renders the full family tree with a layered layout.
 * @param {Array} members - The array of all members.
 */
function renderFullTree(members) {
  const container = document.getElementById("tree-container");
  container.innerHTML = "";
  container.style.gap = `${levelHeight}px`;

  const visibleMembers = members.filter((m) => !m.isPrivate);
  const levels = {};
  visibleMembers.forEach((m) => {
    const lvl = m.level || 0;
    if (!levels[lvl]) levels[lvl] = [];
    levels[lvl].push(m);
  });

  Object.keys(levels).sort((a, b) => a - b).forEach((lvl) => {
    const levelDiv = document.createElement("div");
    levelDiv.className = `level level-depth-${lvl}`;
    levelDiv.style.gap = `${siblingGap}px`;
    levels[lvl].forEach((m) => createCardIn(levelDiv, m, ""));
    container.appendChild(levelDiv);
  });
}

/**
 * Renders the tree from the perspective of a single focused member.
 * @param {string} focusId - The ID of the member to focus on.
 * @param {Array} allMembers - The array of all members.
 */
function renderPerspectiveTree(focusId, allMembers) {
  viewMode = "perspective";
  const container = document.getElementById("tree-container");
  container.innerHTML = "";
  container.style.gap = `${levelHeight / 1.5}px`;

  let person = allMembers.find((m) => m.id === focusId);
  if (!person) {
    person = allMembers.find((m) => m.isRoot) || allMembers[0];
    if (!person) return renderEmptyState();
  }
  currentFocusId = person.id;

  const spouses = allMembers.filter(m => m.id === person.spouse || m.spouse === person.id);
  const children = allMembers.filter(m => m.parent === (person.gender === 'male' ? person.id : (spouses[0]?.id || null)));
  const father = allMembers.find(m => m.id === person.parent);
  const mother = father ? allMembers.find(m => m.id === father.spouse || m.spouse === father.id) : null;
  const siblings = person.parent ? allMembers.filter(m => m.parent === person.parent && m.id !== person.id) : [];

  container.innerHTML = `
    <div class="level level-depth-${(person.level || 0) - 1}"><div id="p-row" class="level-group section-label" data-label="الآباء"></div></div>
    <div class="level level-depth-${person.level || 0}"><div id="m-row" class="level-group">
        <div id="siblings-group" class="level-group section-label" data-label="الإخوة"></div>
        <div id="main-couple" class="couple-wrapper highlighted"></div>
    </div></div>
    <div class="level level-depth-${(person.level || 0) + 1}"><div id="c-row" class="level-group section-label" data-label="الأبناء"></div></div>
  `;

  if (father) createCardIn(document.getElementById("p-row"), father, "الأب");
  if (mother) createCardIn(document.getElementById("p-row"), mother, "الأم");
  
  createCardIn(document.getElementById("main-couple"), person, "أنا", "highlight");
  spouses.forEach(s => createCardIn(document.getElementById("main-couple"), s, s.gender === 'male' ? 'زوج' : 'زوجة'));
  
  siblings.forEach(s => createCardIn(document.getElementById("siblings-group"), s, s.gender === 'male' ? 'أخ' : 'أخت'));
  children.forEach(c => createCardIn(document.getElementById("c-row"), c, c.gender === 'male' ? 'ابن' : 'ابنة'));
}

/**
 * Creates a member card and appends it to a given div.
 * @param {HTMLElement} div - The container element.
 * @param {object} m - The member data object.
 * @param {string} label - The relationship label for the card.
 * @param {string} [cls=''] - Additional CSS classes.
 */
function createCardIn(div, m, label, cls = "") {
  const card = document.createElement("div");
  card.id = m.id;
  card.className = `member-card ${m.gender === "female" ? "female-card" : "male-card"} ${cls}`;
  card.onclick = () => window.openBio(m.id);
  card.innerHTML = `<img src="${m.img || (m.gender === 'male' ? 'mainmale.png' : 'mainfemale.png')}" onerror="this.src='${m.gender === 'male' ? 'mainmale.png' : 'mainfemale.png'}'"><div class="info"><h3>${m.name}</h3><span>${label}</span></div>`;
  div.appendChild(card);
}

/**
 * Draws SVG lines connecting the member cards in the DOM.
 * @param {Array} members - The array of all members.
 */
function drawLines(members) {
  const svg = document.getElementById("tree-svg");
  if (!svg) return;

  svg.innerHTML = "";
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  defs.innerHTML = `<linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color: var(--primary-glow); stop-opacity: 1" /><stop offset="100%" style="stop-color: var(--secondary-glow); stop-opacity: 1" /></linearGradient>`;
  svg.appendChild(defs);

  const svgRect = svg.getBoundingClientRect();
  const positions = new Map();
  const fragment = document.createDocumentFragment();

  members.forEach((m) => {
    const el = document.getElementById(m.id);
    if (el) {
      const r = el.getBoundingClientRect();
      positions.set(m.id, {
        x: r.left + r.width / 2 - svgRect.left,
        y: r.top - svgRect.top,
        bottomY: r.bottom - svgRect.top,
        height: r.height,
      });
    }
  });

  members.forEach((m) => {
    const childPos = positions.get(m.id);
    if (!childPos) return;

    if (m.parent) {
      const parentPos = positions.get(m.parent);
      if (parentPos) {
        const path = createSVGPath(parentPos.x, parentPos.bottomY, childPos.x, childPos.y);
        fragment.appendChild(path);
      }
    }
  });

  svg.appendChild(fragment);
}

/**
 * Creates a curved SVG path between two points.
 * @param {number} x1 - Start X.
 * @param {number} y1 - Start Y.
 * @param {number} x2 - End X.
 * @param {number} y2 - End Y.
 * @returns {SVGPathElement} The created path element.
 */
function createSVGPath(x1, y1, x2, y2) {
  const midY = (y1 + y2) / 2;
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`);
  path.setAttribute("stroke", "url(#line-gradient)");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke-width", "3");
  path.classList.add("drawing-line");
  return path;
}

/**
 * Renders labels for each generation on the side of the tree.
 */
function renderGenerationLabels() {
    const wrapper = document.querySelector('.tree-wrapper');
    if (!wrapper) return;

    const styleId = 'generation-label-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            .generation-label-container { position: absolute; top: 0; right: 10px; height: 100%; z-index: 1; pointer-events: none; }
            .generation-label { position: absolute; transform: translateY(-50%); writing-mode: vertical-rl; text-orientation: mixed; color: var(--primary-glow); opacity: 0.5; font-size: 0.8rem; font-weight: bold; }
        `;
        document.head.appendChild(style);
    }

    wrapper.querySelectorAll('.generation-label-container').forEach(el => el.remove());

    const labelsContainer = document.createElement('div');
    labelsContainer.className = 'generation-label-container';
    
    const levels = {};
    document.querySelectorAll('.level').forEach(levelDiv => {
        const firstCard = levelDiv.querySelector('.member-card');
        if (firstCard) {
            const level = parseInt(levelDiv.className.match(/level-depth-(\d+)/)?.[1] || '0');
            if (!isNaN(level) && levels[level] === undefined) {
                levels[level] = firstCard.getBoundingClientRect().top + (firstCard.getBoundingClientRect().height / 2);
            }
        }
    });

    const wrapperTop = wrapper.getBoundingClientRect().top;

    for (const level in levels) {
        const label = document.createElement('div');
        label.className = 'generation-label';
        label.style.top = `${levels[level] - wrapperTop}px`;
        label.innerText = `الجيل ${level}`;
        labelsContainer.appendChild(label);
    }
    wrapper.appendChild(labelsContainer);
}

/**
 * Scales the tree container to fit the screen width.
 */
function fitTreeToScreen() {
  const container = document.getElementById("tree-container");
  if (!container || !container.scrollWidth) return;
  const screenWidth = window.innerWidth * 0.95;
  const treeWidth = container.scrollWidth;

  if (treeWidth > screenWidth) {
    const scale = screenWidth / treeWidth;
    container.style.transform = `scale(${scale})`;
  } else {
    container.style.transform = "scale(1)";
  }
  container.style.transformOrigin = "top center";
}

/**
* Renders an empty state message when no members are present.
*/
function renderEmptyState() {
  const container = document.getElementById("tree-container");
  if(container) {
      container.innerHTML = `<div class="empty-state"><button class="btn-start" onclick="window.openBio(null, true)">➕ ابدأ بإضافة أول فرد</button></div>`;
  }
}

/**
 * Smoothly animates the transition between tree views.
 * @param {Function} callback - The function to execute mid-transition.
 */
function animateTransition(callback) {
  const container = document.getElementById("tree-container");
  if (!container) return;

  container.classList.add("tree-exit");

  setTimeout(() => {
    callback();
    container.classList.remove("tree-exit");
    container.classList.add("tree-enter");
    setTimeout(() => container.classList.remove("tree-enter"), 500);
  }, 400);
}
/* ==========================================================================
   9. ACTION FUNCTIONS (ADD, EDIT, DELETE)
   ========================================================================== */

/**
 * Adds a new relative to the tree.
 */
window.addNewRelative = async () => {
  const focusId = document.getElementById("modal-id-display").innerText;
  const focusPerson = window.currentMembers.find((m) => m.id === focusId);
  const isRoot = focusId === "ROOT";

  if (!isRoot && !focusPerson)
    return window.customAlert("خطأ: لم يتم تحديد الشخص المرجعي.", "error");

  const relation = document.getElementById("relation-type").value;
  if (!relation)
    return window.customAlert("الرجاء تحديد صلة القرابة.", "warning");

  const newName = document.getElementById("new-name").value.trim();
  if (!newName)
    return window.customAlert("الرجاء إدخال اسم الشخص الجديد.", "warning");

  try {
    const batch = writeBatch(db);
    const membersCollectionRef = collection(db, "trees", window.currentTreeId, "members");
    
    const newGender = document.getElementById("new-gender").value;
    const newMemberData = {
      name: newName,
      gender: newGender,
      img: document.getElementById("new-img").value.trim() || (newGender === 'male' ? 'mainmale.png' : 'mainfemale.png'),
      dob: document.getElementById("new-dob").value,
      isDeceased: document.getElementById("new-is-deceased").checked,
      deathDate: document.getElementById("new-death-date").value || null,
      isPrivate: document.getElementById("new-hide-main").checked,
      createdAt: new Date().toISOString(),
    };

    const newDocRef = doc(membersCollectionRef);
    const newMemberId = newDocRef.id;

    const focusUpdate = {};
    const newMemberUpdate = {};

    if (isRoot) {
        newMemberUpdate.isRoot = true;
        newMemberUpdate.level = 0;
    } else if (relation === "child") {
      newMemberUpdate.parent = focusId;
      newMemberUpdate.level = focusPerson.level + 1;
    } else if (relation === "parent") {
      focusUpdate.parent = newMemberId;
      newMemberUpdate.level = focusPerson.level - 1;
    } else if (relation === "sibling") {
      newMemberUpdate.parent = focusPerson.parent;
      newMemberUpdate.level = focusPerson.level;
    } else if (relation === "spouse") {
      focusUpdate.spouse = newMemberId;
      newMemberUpdate.spouse = focusId;
      newMemberUpdate.level = focusPerson.level;
    }

    batch.set(newDocRef, { ...newMemberData, ...newMemberUpdate });
    if (!isRoot) {
      const focusRef = doc(membersCollectionRef, focusId);
      batch.update(focusRef, focusUpdate);
    }

    await batch.commit();
    window.customAlert("تمت الإضافة بنجاح!", "success");
    window.closeBio();
  } catch (error) {
    window.customAlert("فشل إضافة القريب: " + error.message, "error");
  }
};

/**
 * Saves the edited data for a member.
 */
window.saveEdit = async () => {
  const memberId = document.getElementById("modal-id-display").innerText;
  const updatedData = {
    name: document.getElementById("edit-name").value.trim(),
    img: document.getElementById("edit-img").value.trim(),
    dob: document.getElementById("edit-dob").value,
    isPrivate: document.getElementById("edit-hide-main")?.checked,
    isDeceased: document.getElementById("edit-is-deceased").checked,
    deathDate: document.getElementById("edit-death-date").value || null,
  };

  if (!updatedData.name) return window.customAlert("الاسم مطلوب.", "warning");

  try {
    const memberRef = doc(db, "trees", window.currentTreeId, "members", memberId);
    await updateDoc(memberRef, updatedData);
    window.customAlert("تم حفظ التعديلات بنجاح!", "success");
    toggleEditSection(false);
  } catch (error) {
    window.customAlert("فشل حفظ التعديلات: " + error.message, "error");
  }
};

/**
 * Deletes a member or unlinks them from a user account.
 */
window.deleteMember = async () => {
  const memberId = document.getElementById("modal-id-display").innerText;
  const member = window.currentMembers.find((m) => m.id === memberId);
  if (!member) return;

  const isMyProfile = member.linkedUserId === currentUser.uid;
  const canPerformDelete = window.isTreeOwner || window.canDelete;

  if (isMyProfile) {
    if (confirm("هل أنت متأكد من فك ربط حسابك بهذه الشخصية؟")) {
      await unlinkMember(memberId, currentUser.uid);
    }
  } else if (canPerformDelete && member.linkedUserId) {
     if (confirm(`⚠️ هذا البروفايل مرتبط بمستخدم. هل تريد طرده وفك الربط؟`)) {
      await unlinkMember(memberId, member.linkedUserId);
    }
  } else if (canPerformDelete && !member.linkedUserId) {
    if (confirm(`هل أنت متأكد من حذف "${member.name}" نهائياً من الشجرة؟`)) {
      try {
        const memberRef = doc(db, "trees", window.currentTreeId, "members", memberId);
        await deleteDoc(memberRef);
        window.customAlert("تم الحذف بنجاح.", "success");
        window.closeBio();
      } catch (error) {
        window.customAlert("فشل الحذف: " + error.message, "error");
      }
    }
  } else {
    window.customAlert("ليس لديك صلاحية الحذف.", "error");
  }
};

/**
 * Unlinks a user account from a member profile.
 * @param {string} memberId - The ID of the member to unlink.
 * @param {string} targetUid - The UID of the user to unlink.
 */
async function unlinkMember(memberId, targetUid) {
    try {
        const batch = writeBatch(db);
        const memberRef = doc(db, "trees", window.currentTreeId, "members", memberId);
        batch.update(memberRef, { linkedUserId: null });

        const userRef = doc(db, "users", targetUid);
        batch.update(userRef, { linkedTreeId: null, linkedMemberId: null });

        await batch.commit();
        window.customAlert("تم فك الربط بنجاح.", "success");

        if (targetUid === currentUser.uid) {
            window.location.href = 'index.html';
        } else {
            window.closeBio();
        }
    } catch (error) {
        window.customAlert("فشل فك الربط: " + error.message, "error");
    }
}

/* ==========================================================================
   MISSING FEATURES MODULE
   (Stats, Tour, Export, Occasion Manager, Maternal Toggle)
   ========================================================================== */

/* --- 1. STATISTICS SYSTEM --- */
window.showStatsModal = () => {
    const members = window.currentMembers || [];
    if (members.length === 0) return window.customAlert("لا توجد بيانات لعرضها!", "warning");

    const males = members.filter(m => m.gender === "male").length;
    const females = members.filter(m => m.gender === "female").length;
    
    // Most Common Name Logic
    const names = members.map(m => m.name.split(" ")[0]);
    const nameCounts = {};
    let mostCommonName = "-", maxCount = 0;
    names.forEach(name => {
        nameCounts[name] = (nameCounts[name] || 0) + 1;
        if (nameCounts[name] > maxCount) { maxCount = nameCounts[name]; mostCommonName = name; }
    });

    // Age Analysis
    const ages = members.map(m => m.dob ? new Date().getFullYear() - new Date(m.dob).getFullYear() : 0).filter(a => a > 0);
    const avgAge = ages.length ? Math.floor(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;
    
    // Fertility Rate
    const parentsCount = new Set(members.map(m => m.parent).filter(p => p)).size;
    const fertilityRate = parentsCount ? (members.length / parentsCount).toFixed(1) : 0;

    const statsHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
        <div class="stat-card" style="border-color:var(--text-main)"><div class="stat-num">${members.length}</div><div class="stat-label">فرد بالعائلة</div></div>
        <div class="stat-card" style="border-color:var(--secondary-glow)"><div class="stat-num">✨ ${mostCommonName}</div><div class="stat-label">أكثر اسم (${maxCount})</div></div>
        <div class="stat-card" style="border-color:var(--male-color)"><div class="stat-num" style="color:var(--male-color)">${males} 👨</div><div class="stat-label">ذكور (${Math.round((males/members.length)*100)}%)</div></div>
        <div class="stat-card" style="border-color:var(--female-color)"><div class="stat-num" style="color:var(--female-color)">${females} 👩</div><div class="stat-label">إناث (${Math.round((females/members.length)*100)}%)</div></div>
      </div>
      <div style="text-align:center; font-size:0.8rem; opacity:0.8;">متوسط الأعمار: <b>${avgAge}</b> سنة | معدل الذرية: <b>${fertilityRate}</b> طفل/أسرة</div>
      <style>.stat-card { background: rgba(255,255,255,0.05); padding: 15px; border-radius: 15px; border-bottom: 3px solid; text-align: center; } .stat-num { font-size: 1.5rem; font-weight: bold; } .stat-label { font-size: 0.8rem; opacity: 0.8; }</style>
    `;

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.style.display = "flex";
    modal.innerHTML = `<div class="modal-content glass" style="max-width:380px;"><span class="close-btn" onclick="this.closest('.modal').remove()">&times;</span><h3 class="modal-title">📊 إحصائيات العائلة</h3>${statsHTML}</div>`;
    document.body.appendChild(modal);
};

/* --- 2. EXPORT IMAGE SYSTEM --- */
window.exportTreeImage = async () => {
    window.customAlert("📸 جاري التقاط الصورة... لحظة واحدة", "info");
    if (!window.domtoimage) {
        await new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/dom-to-image/2.6.0/dom-to-image.min.js";
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    const node = document.getElementById("tree-container");
    const wrapper = document.querySelector(".tree-wrapper");
    const originalTransform = node.style.transform;
    const originalOverflow = wrapper.style.overflow;

    try {
        node.style.transform = "scale(1)";
        node.style.transformOrigin = "top left";
        node.style.width = node.scrollWidth + "px";
        node.style.height = node.scrollHeight + "px";
        wrapper.style.overflow = "visible";

        // Wait for styles to settle
        await new Promise(r => setTimeout(r, 500));

        const dataUrl = await domtoimage.toPng(node, {
            bgcolor: document.documentElement.getAttribute("data-theme") === "dark" ? "#020604" : "#f0fdf4",
            quality: 1,
            style: { transform: "scale(1)", "transform-origin": "top left", width: node.scrollWidth + "px", height: node.scrollHeight + "px" }
        });

        const link = document.createElement("a");
        link.download = `family-tree-${new Date().toISOString().slice(0,10)}.png`;
        link.href = dataUrl;
        link.click();
        window.customAlert("تم حفظ الصورة بنجاح! ✅", "success");
    } catch (error) {
        window.customAlert("حدث خطأ أثناء حفظ الصورة ❌", "error");
    } finally {
        node.style.transform = originalTransform;
        node.style.width = "";
        node.style.height = "";
        wrapper.style.overflow = "";
    }
};

/* --- 3. OCCASIONS MANAGER (EDIT/DELETE) --- */
window.openOccasionsManager = () => {
    document.getElementById("view-section").style.display = "none";
    document.getElementById("edit-section").style.display = "none";
    document.getElementById("add-section").style.display = "none";
    document.getElementById("occasions-manager-section").style.display = "block";
    renderManageOccasionsList();
};

window.closeOccasionsManager = () => {
    document.getElementById("occasions-manager-section").style.display = "none";
    document.getElementById("view-section").style.display = "block";
};

function renderManageOccasionsList() {
    const id = document.getElementById("modal-id-display").innerText;
    const m = window.currentMembers.find(x => x.id === id);
    const container = document.getElementById("manage-occasions-list");
    container.innerHTML = "";
    
    const createRow = (type, title, name, date) => `
        <div class="occasion-edit-card" style="background:rgba(0,0,0,0.05); padding:10px; margin-bottom:10px; border-radius:8px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><strong>${title} من ${name}</strong></div>
            <div style="display:flex; gap:5px;">
                <input type="date" id="edit-date-${type}" value="${date}" class="mini-input">
                <button class="btn-primary" onclick="window.saveOccasionDate('${type}')">💾</button>
                <button class="btn-danger" onclick="window.confirmDeleteOccasion('${type}')">🗑️</button>
            </div>
        </div>`;

    let found = false;
    const today = new Date().toISOString().slice(0,10);

    if (m.marriageDate && m.spouse && m.marriageDate >= today) {
        const spouse = window.currentMembers.find(x => x.id === m.spouse);
        container.innerHTML += createRow("marriage", "💍 زواج", spouse?.name || "??", m.marriageDate);
        found = true;
    }
    if (m.engagementDate && m.fiance && m.engagementDate >= today) {
        const fiance = window.currentMembers.find(x => x.id === m.fiance);
        container.innerHTML += createRow("engagement", "💍 خطوبة", fiance?.name || "??", m.engagementDate);
        found = true;
    }

    if (!found) container.innerHTML = "<div style='text-align:center; opacity:0.6;'>لا توجد مناسبات قادمة لتعديلها.</div>";
}

window.saveOccasionDate = async (type) => {
    const id = document.getElementById("modal-id-display").innerText;
    const newDate = document.getElementById(`edit-date-${type}`).value;
    const m = window.currentMembers.find(x => x.id === id);
    const partnerId = type === "marriage" ? m.spouse : m.fiance;
    const field = type === "marriage" ? "marriageDate" : "engagementDate";

    try {
        const batch = writeBatch(db);
        batch.update(doc(db, "trees", window.currentTreeId, "members", id), { [field]: newDate });
        if (partnerId) batch.update(doc(db, "trees", window.currentTreeId, "members", partnerId), { [field]: newDate });
        await batch.commit();
        window.customAlert("تم تحديث التاريخ بنجاح ✅", "success");
    } catch (e) { window.customAlert("خطأ: " + e.message, "error"); }
};

window.confirmDeleteOccasion = async (type) => {
    if (!confirm("هل أنت متأكد من حذف المناسبة وفك الارتباط؟")) return;
    const id = document.getElementById("modal-id-display").innerText;
    const m = window.currentMembers.find(x => x.id === id);
    const partnerId = type === "marriage" ? m.spouse : m.fiance;

    try {
        const batch = writeBatch(db);
        const updates = type === "marriage" ? { spouse: null, marriageDate: null } : { fiance: null, engagementDate: null };
        batch.update(doc(db, "trees", window.currentTreeId, "members", id), updates);
        if (partnerId) batch.update(doc(db, "trees", window.currentTreeId, "members", partnerId), updates);
        await batch.commit();
        renderManageOccasionsList();
        window.customAlert("تم الحذف بنجاح.", "success");
    } catch (e) { window.customAlert("خطأ: " + e.message, "error"); }
};

window.breakMarriage = async () => window.confirmDeleteOccasion("marriage");
window.breakEngagement = async () => window.confirmDeleteOccasion("engagement");

/* --- 4. HELP TOUR SYSTEM --- */
const tourSteps = [
    { target: null, title: "👋 أهلاً بك", desc: "جولة سريعة في شجرة العائلة." },
    { target: ".search-modern-wrapper", title: "🔍 البحث", desc: "ابحث عن أي شخص هنا." },
    { target: "#tree-container", title: "🌲 الشجرة", desc: "اضغط على أي كارت لفتح التفاصيل." },
    { target: "button[onclick='window.openRelCalc()']", title: "🔮 القرابة", desc: "اكتشف صلة القرابة بين أي شخصين." },
    { target: null, title: "🎉 النهاية", desc: "استمتع ببناء شجرتك!" }
];
let currentTourStep = 0;

window.startTour = () => {
    currentTourStep = 0;
    document.getElementById("tour-overlay").style.display = "block";
    renderTourStep();
};
window.endTour = () => document.getElementById("tour-overlay").style.display = "none";
window.nextTourStep = () => {
    currentTourStep++;
    if (currentTourStep >= tourSteps.length) window.endTour();
    else renderTourStep();
};

function renderTourStep() {
    const step = tourSteps[currentTourStep];
    const tooltip = document.getElementById("tour-tooltip");
    document.getElementById("tour-title").innerText = step.title;
    document.getElementById("tour-desc").innerText = step.desc;
    document.getElementById("tour-step-count").innerText = `${currentTourStep + 1} / ${tourSteps.length}`;
    
    // Simple centering logic (Simplified for clean code)
    if(step.target) {
        const el = document.querySelector(step.target);
        if(el) el.scrollIntoView({behavior: "smooth", block: "center"});
    }
}

/* --- 5. MATERNAL TOGGLE --- */
window.toggleMaternalRelatives = () => {
    window.showMaternal = !window.showMaternal;
    const btnSpan = document.querySelector("button[onclick='window.toggleMaternalRelatives()'] span");
    if(btnSpan) btnSpan.innerText = window.showMaternal ? "إخفاء الأخوال" : "أقارب الأم";
    refreshUI();
};

/* ==========================================================================
   10. SYSTEM BOOTSTRAPPER & INITIALIZATION
   ========================================================================== */

/**
 * Binds all necessary functions to the global window object to be accessible from HTML.
 */
function bindGlobalFunctions() {
    const functionsToExpose = {
        // Core Navigation & UI
        showFullTree, toggleProfileMenu, openMyProfileSettings, toggleTheme,
        openTreeSettings, performLogout, searchMember, toggleNavMenu, goBack,
        showStatsModal, openRelCalc, toggleMaternalRelatives, exportTreeImage,
        closeBio, toggleAppMode, switchProfile, shareMember,
        
        // Modals & Forms
        openBio, toggleAddSection, toggleEditSection, addNewRelative, saveEdit,
        deleteMember, resetPhotoField, addSocialRow, enableDeceasedMode,
        closeCustomAlert, closeCustomConfirm,
        
        // Relationship Calculator
        searchForCalc, swapCalcPersons, calculateRelationship, closeRelCalc,

        // Occasions System
        openOccasionModal, updateOccasionUI, searchForOccasionPartner,
        handleGlobalSpouseSearch, saveOccasion, breakEngagement, breakMarriage,
        openOccasionsManager, closeOccasionsManager, saveOccasionDate, confirmDeleteOccasion,
        
        // Admin & Permissions
        addNewAdmin, updateAdminPerm, removeAdmin, transferOwnership,

        // Chat System
        toggleChatPanel, openFamilyChat, showChatList, showUserSearchForChat,
        searchUserForChat, sendMessage, handleEnter, toggleEmojiPicker,

        // Tour
        startTour, endTour, nextTourStep,

        // Auth/Logout
        performLogout, closeLogoutModal, closeGoogleAlert,
    };

    for (const funcName in functionsToExpose) {
        if (typeof window[funcName] === 'function') {
            window[funcName] = window[funcName];
        } else if (typeof functionsToExpose[funcName] === 'function') {
             window[funcName] = functionsToExpose[funcName];
        }
    }
}

/**
 * The main entry point for the application. Initializes auth state listener and data loading.
 */
function startApplication() {
    const loader = document.getElementById("loader-wrapper");

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            document.getElementById("nav-user-img").src = user.photoURL || "mainmale.png";
            document.getElementById("dropdown-user-name").innerText = user.displayName || "مستخدم";

            try {
                const urlParams = new URLSearchParams(window.location.search);
                const sharedTreeId = urlParams.get("tree");
                const sharedMemberId = urlParams.get("id");

                let treeToLoad = sharedTreeId;
                if (!treeToLoad) {
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) {
                        treeToLoad = userDoc.data().linkedTreeId;
                        if(treeToLoad) localStorage.setItem('lastTreeId', treeToLoad);
                    }
                }
                
                if (!treeToLoad) treeToLoad = localStorage.getItem('lastTreeId');

                if (treeToLoad) {
                    window.currentTreeId = treeToLoad;
                    if (sharedMemberId) {
                        currentFocusId = sharedMemberId;
                        viewMode = 'perspective';
                    }
                    loadTreeData(window.currentTreeId);
                } else {
                    window.customAlert("لم يتم العثور على شجرة مرتبطة بحسابك!", "error");
                    setTimeout(() => (window.location.href = "index.html"), 2500);
                }
            } catch (error) {
                if (loader) loader.style.display = "none";
                window.customAlert("حدث خطأ فادح أثناء تحميل بيانات الشجرة.", "error");
            }
        } else {
            window.location.href = "index.html";
        }
    });
}

/**
 * Main Execution Block - Runs after the DOM is fully loaded.
 */
document.addEventListener("DOMContentLoaded", () => {
    bindGlobalFunctions();

    flatpickr.localize(flatpickr.l10ns.ar);
    const config = { dateFormat: "Y-m-d", disableMobile: true };
    ["new-dob", "edit-dob", "new-death-date", "edit-death-date", "occasion-date"].forEach(id => {
        flatpickr(`#${id}`, config);
    });

    document.querySelector("emoji-picker")?.addEventListener('emoji-click', event => {
        if(currentEmojiInput) currentEmojiInput.value += event.detail.unicode;
    });

    const savedTheme = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);

    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            if (e.target.id && e.target.style.display !== 'none') {
                if (e.target.id === 'bio-modal') window.closeBio();
                else window.closeModalSmoothly(e.target.id);
            }
        }
    });

    startApplication();
});