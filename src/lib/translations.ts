export type Language = 'en' | 'fr' | 'ar';

export interface TranslationSet {
  appTitle: string;
  appSubtitle: string;
  titleLogin: string;
  titleSignup: string;
  labelEmail: string;
  labelPassword: string;
  labelRememberMe: string;
  placeholderEmail: string;
  placeholderPassword: string;
  btnLogin: string;
  btnSignup: string;
  toggleToSignup: string;
  toggleToLogin: string;
  loadingText: string;
  errorEmptyFields: string;
  dir: 'ltr' | 'rtl';
}

export const translations: Record<Language, TranslationSet> = {
  en: {
    appTitle: 'SuperManager Pro',
    appSubtitle: 'Manage sales, inventory, and insights seamlessly',
    titleLogin: 'Sign In',
    titleSignup: 'Create Account',
    labelEmail: 'Email Address',
    labelPassword: 'Password',
    labelRememberMe: 'Remember me',
    placeholderEmail: 'you@store.com',
    placeholderPassword: '••••••••',
    btnLogin: 'Sign In',
    btnSignup: 'Sign Up',
    toggleToSignup: "Don't have an account? Sign Up",
    toggleToLogin: 'Already have an account? Sign In',
    loadingText: 'Authenticating...',
    errorEmptyFields: 'Please fill in all fields',
    dir: 'ltr'
  },
  fr: {
    appTitle: 'SuperManager Pro',
    appSubtitle: 'Gérez vos ventes, stocks et analyses en toute fluidité',
    titleLogin: 'Connexion',
    titleSignup: 'Créer un compte',
    labelEmail: 'Adresse e-mail',
    labelPassword: 'Mot de passe',
    labelRememberMe: 'Se souvenir de moi',
    placeholderEmail: 'vous@boutique.com',
    placeholderPassword: '••••••••',
    btnLogin: 'Se connecter',
    btnSignup: "S'inscrire",
    toggleToSignup: "Vous n'avez pas de compte ? S'inscrire",
    toggleToLogin: 'Vous avez déjà un compte ? Se connecter',
    loadingText: 'Authentification...',
    errorEmptyFields: 'Veuillez remplir tous les champs',
    dir: 'ltr'
  },
  ar: {
    appTitle: 'سوبر مانجر برو',
    appSubtitle: 'إدارة المبيعات والمخزون والتقارير بكل سلاسة وبساطة',
    titleLogin: 'تسجيل الدخول',
    titleSignup: 'إنشاء حساب جديد',
    labelEmail: 'البريد الإلكتروني',
    labelPassword: 'كلمة المرور',
    labelRememberMe: 'تذكرني',
    placeholderEmail: 'you@store.com',
    placeholderPassword: '••••••••',
    btnLogin: 'تسجيل الدخول',
    btnSignup: 'إنشاء الحساب',
    toggleToSignup: 'ليس لديك حساب؟ سجل الآن',
    toggleToLogin: 'لديك حساب بالفعل؟ تسجيل الدخول',
    loadingText: 'جاري التحقق من الهوية...',
    errorEmptyFields: 'يرجى ملء جميع الحقول المطلوبة',
    dir: 'rtl'
  }
};
