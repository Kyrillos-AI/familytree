/* ========================================= */
/* 🚪 منطق صفحة الدخول البسيطة */
/* ========================================= */

// 1. الدخول للتطبيق (بعد تسجيل الدخول)
window.enterApp = () => {
  const landing = document.getElementById("landing-page");
  const loginCard = document.querySelector(".glass-login-card");

  // حركة خروج الكارت (ينزل لتحت ويختفي)
  if (loginCard) {
    loginCard.style.transform = "scale(0.9) translateY(20px)";
    loginCard.style.opacity = "0";
    loginCard.style.transition = "all 0.5s ease";
  }

  // إخفاء الصفحة بالكامل
  setTimeout(() => {
    landing.style.opacity = "0";
    landing.style.transition = "opacity 0.5s ease";

    setTimeout(() => {
      landing.style.display = "none";

      // إظهار التطبيق
      const appView = document.getElementById("app-view");
      appView.style.display = "block";
      appView.style.opacity = "0";
      appView.style.transform = "scale(1.05)"; // يبدأ مكبر سنة

      // تشغيل أنيميشن الدخول للتطبيق
      requestAnimationFrame(() => {
        appView.style.transition = "all 0.8s cubic-bezier(0.22, 1, 0.36, 1)";
        appView.style.opacity = "1";
        appView.style.transform = "scale(1)";
      });
    }, 500);
  }, 200);
};

// 2. تسجيل الخروج (العودة لصفحة الدخول)
window.exitApp = () => {
  const appView = document.getElementById("app-view");

  // إخفاء التطبيق
  appView.style.opacity = "0";
  appView.style.transform = "scale(1.05)";

  setTimeout(() => {
    appView.style.display = "none";

    const landing = document.getElementById("landing-page");
    landing.style.display = "block";
    landing.style.opacity = "0";

    const loginCard = document.querySelector(".glass-login-card");
    if (loginCard) {
      loginCard.style.transform = "scale(0.9) translateY(20px)";
      loginCard.style.opacity = "0";
    }

    requestAnimationFrame(() => {
      landing.style.opacity = "1";

      if (loginCard) {
        loginCard.style.transition = "all 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)";
        loginCard.style.transform = "scale(1) translateY(0)";
        loginCard.style.opacity = "1";
      }
    });

    // هنا ممكن تضيف كود Firebase SignOut الفعلي لو مش مضيوف في auth.js
    // if (auth) auth.signOut();
  }, 500);
};
/* ========================================= */
/* 🔔 نظام الإشعارات الشامل (Global Notifications) */
/* ========================================= */

window.showNotification = (message, type = "info") => {
  // 1. تحديد الأيقونة واللون بناءً على نوع الرسالة
  let icon = "🔔";
  let title = "تنبيه";
  let color = "var(--primary-glow)"; // أخضر افتراضي

  if (type === "error") {
    icon = "⚠️";
    title = "خطأ";
    color = "#ff4757"; // أحمر
  } else if (type === "success") {
    icon = "✅";
    title = "نجاح";
    color = "#10b981"; // أخضر
  } else if (type === "search") {
    icon = "🔍";
    title = "بحث";
    color = "#3b82f6"; // أزرق
  }

  // 2. الوصول لعناصر المودال (أو إنشاؤها لو مش موجودة)
  let overlay = document.getElementById("google-alert-overlay");

  // لو المودال مش موجود في الصفحة (زي صفحة الـ Landing)، ننشئه بالجافاسكريبت حالاً
  if (!overlay) {
    const modalHTML = `
            <div id="google-alert-overlay" class="alert-overlay">
                <div class="custom-alert glass">
                    <div class="alert-icon" id="notif-icon">${icon}</div>
                    <h3 id="notif-title" style="margin:5px 0 10px; color:${color}">${title}</h3>
                    <p id="google-alert-message" style="font-weight: 500; font-size: 1rem; opacity:0.9">${message}</p>
                    <button class="btn-confirm" onclick="document.getElementById('google-alert-overlay').style.display='none'" style="width: 100%; margin-top: 15px; background: ${color}">
                        حسناً
                    </button>
                </div>
            </div>
        `;
    document.body.insertAdjacentHTML("beforeend", modalHTML);
    overlay = document.getElementById("google-alert-overlay");
  }

  // 3. تحديث المحتوى
  const iconEl = overlay.querySelector(".alert-icon");
  const titleEl = document.getElementById("notif-title");
  const msgEl = document.getElementById("google-alert-message");
  const btnEl = overlay.querySelector(".btn-confirm");

  if (iconEl) iconEl.innerHTML = icon;
  if (titleEl) {
    titleEl.innerText = title;
    titleEl.style.color = color;
  }
  if (msgEl) msgEl.innerText = message;
  if (btnEl) btnEl.style.background = color;

  // 4. إظهار المودال مع الأنيميشن
  overlay.style.display = "flex";
  const alertBox = overlay.querySelector(".custom-alert");
  alertBox.style.animation = "none";
  alertBox.offsetHeight; /* trigger reflow */
  alertBox.style.animation =
    "contentPopIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
};

// اختصار سريع عشان نستعمله بسهولة
window.customAlert = (msg, type) => window.showNotification(msg, type);
