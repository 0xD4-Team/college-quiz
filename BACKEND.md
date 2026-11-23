# تفعيل لوحة المدرس ومزامنة الدرجات (اختياري)

المشروع بيشتغل **من غير سيرفر** بشكل كامل (النتائج محفوظة في متصفح كل جهاز). لو عايز الدكتور يشوف درجات كل الطلبة في مكان واحد، اتبع الخطوات دي — Supabase المجاني كافي جداً.

## 1) اعمل مشروع Supabase

1. افتح <https://supabase.com/dashboard> واعمل project جديد (Free plan).
2. بعد ما يتجهز، افتح **SQL Editor** → **New query**.
3. الصق محتوى [`supabase/schema.sql`](supabase/schema.sql) واضغط **Run**.
   - ده يعمل جدول `quiz_results` وسياسات حماية: الطلبة يقدروا **يضيفوا** درجة بس، والمدرس بس يقدر **يقرأ/يمسح**.

## 2) اعمل حساب المدرس

1. من القائمة: **Authentication → Users → Add user → Create new user**.
2. اكتب إيميل وكلمة مرور قوية (ده اللي هتستخدمه في لوحة المدرس).
3. اتأكد إن **Confirm email** مش مفعل للاستخدام التجريبي، أو أكد الإيميل لو مفعل.

## 3) خد مفتاح الـ API

1. **Project Settings → API**.
2. انسخ:
   - **Project URL** (زي `https://abcdefgh.supabase.co`)
   - **Publishable key / anon key** (ابدأ بـ `sb_publishable_` أو `eyJ...`).
3. ⚠️ **ما تستخدمش secret key / service_role** في المتصفح أبداً.

## 4) فعّل الإعداد في الكود

افتح [`js/config.js`](js/config.js) واملأ الحقلين:

```js
window.QUIZ_CONFIG = {
  supabaseUrl: "https://abcdefgh.supabase.co",
  supabaseAnonKey: "sb_publishable_........",
  table: "quiz_results"
};
```

ارفع الملفات من جديد على Netlify / Cloudflare / GitHub Pages.

## 5) الاستخدام

- **الطالب**: يفتح الرابط، يعمل الاختبار، بعد التسليم هيظهر «☁️ تم إرسال الدرجة للوحة المدرس بنجاح».
- **المدرس**: يفتح الرابط → زر **👩‍🏫 لوحة المدرس** → يسجّل الدخول بالإيميل والكلمة → يشوف:
  - عدد المحاولات، متوسط الدرجات، أعلى درجة، نسبة النجاح.
  - رسم توزيع التقديرات.
  - جدول بكل النتائج + زر **تنزيل CSV** (يفتح في Excel بالعربى صح).
  - زر تحديث ومسح النتائج.

## الأمان

- المفتاح العام (anon/publishable) آمن يتكتب في المتصفح لأن **RLS** في `schema.sql` بيمنع الطلبة من قراءة أو مسح نتائج غيرهم.
- لو حبيت تقيّد القراءة على إيميل مدرس معيّن فقط، بدّل سياسة `Teachers can read results` إلى:

```sql
create policy "Only specific teacher can read"
on public.quiz_results for select
to authenticated
using ((select auth.jwt() ->> 'email') = 'teacher@example.com');
```

## تقدر ترجع للمحلي في أي وقت

امسح قيم `supabaseUrl` و `supabaseAnonKey` في `js/config.js` → الموقع يرجع للوضع المحلي، ولوحة المدرس تعرض نتائج الجهاز الحالي فقط.
