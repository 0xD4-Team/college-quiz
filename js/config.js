/* ============================================================
   إعداد اختياري للسيرفر (Supabase)
   اترك الحقلين فاضيين ← المشروع يشتغل في الوضع المحلي بشكل كامل.
   لمزامنة درجات كل الطلبة على سيرفر: اتبع خطوات BACKEND.md
   ============================================================ */
window.QUIZ_CONFIG = {
  supabaseUrl: "",        // مثال: https://abcdefgh.supabase.co
  supabaseAnonKey: "",    // Publishable / anon key (NOT the secret key)
  table: "quiz_results"   // اسم الجدول اللي في supabase/schema.sql
};
