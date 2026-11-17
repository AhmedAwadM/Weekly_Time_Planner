# مخطط وقتي | Weekly Time Planner

**Baseline:** v3.9  
**نوع المشروع:** Static Web App + PWA shell  
**اللغة:** العربية (RTL)

## ما الذي يحتويه هذا المستودع؟

هذا المستودع هو نقطة البداية الرسمية لنشر النسخة المستقرة v3.9 على GitHub Pages، مع تجهيز هيكل منظم للتطوير المستقبلي.

- `index.html`: نقطة دخول GitHub Pages.
- `src/css/app.css`: تنسيقات الواجهة المستخرجة من النسخة المستقرة.
- `src/js/app.js`: منطق التطبيق الأصلي المستخرج من النسخة المستقرة الأصلية دون إعادة كتابة وظيفية.
- `src/js/pwa-register.js`: تسجيل Service Worker.
- `service-worker.js`: تخزين ملفات التطبيق الأساسية للعمل Offline بعد أول زيارة ناجحة.
- `manifest.webmanifest`: تعريف التطبيق القابل للتثبيت.
- `assets/icons/`: أيقونات التطبيق.
- `config/`: أمثلة إعدادات عامة للمستقبل.
- `database/supabase/`: مكان مخصص لاحقًا لمخطط قاعدة البيانات وملفات migrations.
- `data/` و`backups/`: مجلدات محلية اختيارية؛ ملفات JSON الشخصية مستثناة من Git.

## الوضع الحالي للبيانات

هذه المرحلة **لا تضيف Supabase ولا مزامنة سحابية**. بيانات المستخدم تظل محلية داخل المتصفح كما في التطبيق الأساسي، ويمكن نقلها باستخدام JSON Export / Import.

GitHub يحفظ **كود التطبيق وإصداراته**، وليس مهامك الشخصية. لا ترفع ملفات JSON الخاصة بك إلى المستودع.

## التشغيل محليًا

الأفضل تشغيل المشروع عبر خادم محلي بدل فتح `index.html` مباشرة:

```bash
python -m http.server 8000
```

ثم افتح:

```text
http://localhost:8000/
```

يمكن أيضًا استخدام إضافة Live Server في VS Code.

## نشر GitHub Pages

1. أنشئ مستودعًا جديدًا باسم `weekly-time-planner`.
2. ارفع محتويات هذا المجلد إلى الفرع `main`.
3. من المستودع افتح **Settings → Pages**.
4. تحت **Build and deployment** اختر **Deploy from a branch**.
5. اختر Branch: `main` وFolder: `/(root)` ثم اضغط **Save**.
6. انتظر اكتمال النشر، ثم افتح الرابط الذي يظهر في صفحة Pages، وغالبًا يكون:
   `https://YOUR-USERNAME.github.io/weekly-time-planner/`

يوجد ملف `.nojekyll` في الجذر لتجنب معالجة Jekyll غير المطلوبة.

## مهم قبل استخدام رابط GitHub Pages

إذا كانت بياناتك الحالية محفوظة في نسخة HTML محلية (`file://`)، فالموقع المنشور على GitHub Pages سيكون له أصل/مساحة تخزين مختلفة. قبل الانتقال:

1. افتح النسخة المحلية الحالية.
2. صدّر بياناتك إلى JSON.
3. افتح نسخة GitHub Pages بعد النشر.
4. استورد ملف JSON داخلها.

## سياسة الخصوصية والأمان

- GitHub Pages موقع ويب عام على الإنترنت؛ اعتبر ملفات المستودع المنشورة عامة.
- لا ترفع ملفات JSON الشخصية أو بيانات الجدول أو أي أسرار.
- لا تضع كلمات مرور أو مفاتيح خاصة في HTML أو JavaScript.
- ملف `config/app-config.example.js` مثال فقط وغير مستخدم حاليًا.
- عند إضافة Supabase لاحقًا، يجب تصميم تسجيل الدخول وربط كل سجل بمالكه وتفعيل RLS واختبار العزل بين المستخدمين قبل النشر.

## طريقة العمل على الإصدارات

بعد أي تعديل:

```bash
git status
git add .
git commit -m "feat: describe the change"
git push
```

عند إصدار نسخة جديدة:

1. غيّر `VERSION` في `service-worker.js`، وغيّر `?v=` في روابط CSS/JS داخل `index.html` إلى نفس الرقم.
2. أضف قسمًا جديدًا في أعلى `CHANGELOG.md`، وحدّث `Baseline` في هذا الملف ونص الإصدار في الـfooter.
3. شغّل `node tests/check-release.js` — يفشل لو الأرقام غير متطابقة أو وُجد ملف JSON شخصي داخل `data/` أو `backups/`.

اسم الفرع في هذا المستودع `Main` (بحرف كبير)؛ اختره بنفس الشكل في **Settings → Pages**.

راجع:
- `docs/architecture.md`
- `docs/github-pages-setup.md`
- `docs/privacy-and-data.md`
- `docs/release-checklist.md`
- `tests/manual-regression-checklist.md`
