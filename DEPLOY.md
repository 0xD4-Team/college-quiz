# النشر والدومين المجاني (خطوات جاهزة للتسليم)

المشروع **Static Site** (HTML/CSS/JS فقط)، لذلك أي استضافة مجانية تكفي. كل الخيارات أدناه تعطيك رابطاً جاهزاً وHTTPS مجاني.

## الأسهل والأسرع: Netlify Drop (دقيقتان، بدون Git)

1. افتح <https://app.netlify.com/drop>.
2. اسحب مجلد `quiz-app` كاملاً وأفلته في الصفحة (أو اضغط *Browse to upload* واختر المجلد).
3. بعد الرفع ستاخد رابطاً مثل: `https://random-name-123.netlify.app`.
4. غيّر الاسم من **Site settings → Site details → Change site name** إلى اسم سهلة، مثلاً:
   `https://college-quiz-demo.netlify.app`
5. سلم الرابط ده للدكتور / خليه في الـ README.

> ملف `netlify.toml` موجود أصلاً داخل المجلد، فلا تحتاج تضبط أي إعدادات build.

## الأفضل للمساحة: Cloudflare Pages

1. اعمل حساب على <https://dash.cloudflare.com> وسجّل الدخول.
2. من القائمة: **Workers & Pages → Create → Pages → Upload assets**.
3. سمّي المشروع (مثلاً `college-quiz`) وارفع محتوى مجلد `quiz-app`.
4. الرابط النهائي: `https://college-quiz.pages.dev`.

المزايا: bandwidth غير محدود على الخطة المجانية تقريباً وموقع سريع جداً.

## لو عندك GitHub: GitHub Pages

1. اعمل repository جديد (Public) باسم مثلاً `college-quiz`.
2. ارفع محتوى مجلد `quiz-app` (الملفات تكون في جذر الـ repo، مش داخل مجلد فرعي).
3. **Settings → Pages → Build and deployment**، اختر `Deploy from a branch` ثم `main` / `/root` واحفظ.
4. بعد دقيقة أو اثنين الرابط: `https://<username>.github.io/college-quiz/`.

> ملف `.nojekyll` موجود عشان يمنع Jekyll من تجاهل مجلدات `css` و `js`.

## دومين باسم أجمل (اختياري)

- **مجاني 100%**: استخدم الـ subdomain اللي بتمنحه الاستضافة (`*.netlify.app`، `*.pages.dev`، `*.github.io`) — كافي جداً للتسليم.
- **دومين مجاني باسمك**: مواقع زي `is-a.dev` بتدي subdomain مجانية للمطورين/الطلبة مثل `yourname.is-a.dev` (تحتاج Pull Request على GitHub، وخطواتها في موقعهم).
- **دومين حقيقي رخيص**: لو تحب `yourname.com` أو `.xyz`، اشترِه من Namecheap / Cloudflare Registrar (~$10/سنة) واربطه من:
  - Netlify: **Domain management → Add custom domain**
  - Cloudflare Pages: **Custom domains → Set up a custom domain**
  - GitHub Pages: **Settings → Pages → Custom domain** + اعمل ملف `CNAME`.

## قبل ما تسلّم — قائمة فحص

- [ ] افتح الرابط على الجوال والكمبيوتر.
- [ ] جرّب اختبار كامل: أسئلة → تسليم → نتيجة → مراجعة.
- [ ] جرّب زر **طباعة الشهادة** (لازم تظهر الشهادة فقط في معاينة الطباعة).
- [ ] جرّب تحديث الصفحة في نص الاختبار (المحاولة لازم ترجع).
- [ ] غيّر اسمك في `index.html` / أضف اسم الفريق في `footer` لو مطلوب.
- [ ] جرّب زر **لوحة المدرس** (الوضع المحلي شغال فوراً).
- [ ] لو عايز درجات كل الطلبة: اتبع `BACKEND.md` واملأ `js/config.js`.
- [ ] خلي الرابط + كود الـ repo (لو فيه) في ملف التسليم.

## ملاحظة مهمة

الدرجات والنتائج محفوظة **محلياً في متصفح كل جهاز**، مش على سيرفر. ده ميزة (خصوصية وصفر تكلفة)، بس لو الدكتور عايز لوحة لتجميع درجات كل الطلبة لازم نضيف backend (مثلاً Supabase أو Firebase) — قولّي وأضيفها لك.
