
import React from 'react';
import { 
  CheckCircle, 
  Users, 
  TrendingUp, 
  MessageSquare, 
  Calendar, 
  Award, 
  Rocket, 
  Target, 
  Smartphone,
  Star,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';

const Header = () => (
  <header className="fixed top-0 left-0 right-0 z-50 bg-white/5 backdrop-blur-3xl border-b border-white/10 shadow-2xl">
    <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <div className="flex flex-col">
          <span className="text-2xl font-black tracking-tighter text-white leading-none drop-shadow-sm">ЗАРЯ</span>
        </div>
        <div className="w-px h-6 bg-white/20 mx-2"></div>
        <span className="text-sm font-bold text-white/70 uppercase tracking-widest hidden sm:block">Jeremy's Club</span>
      </div>
      
      <div className="flex items-center">
        <button className="bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md px-8 py-3 rounded-2xl text-sm font-bold hover:shadow-xl hover:shadow-white/5 active:scale-95 transition-all">
          Запросить демо
        </button>
      </div>
    </div>
  </header>
);

const Hero = () => (
  <section className="pt-40 pb-24 gradient-bg text-white overflow-hidden relative">
    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/20 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/4"></div>
    <div className="max-w-7xl mx-auto px-6 relative z-10">
      <div className="max-w-3xl">
        <div className="inline-flex items-center space-x-2 bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-2xl mb-10">
          <Award className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-bold text-blue-400">Эксклюзивное предложение для Jeremy’s Club</span>
        </div>
        <h1 className="text-6xl md:text-8xl font-bold leading-[1.1] mb-10 tracking-tight">
          Управляйте впечатлениями <br />
          <span className="text-blue-400">и растите прибыль</span>
        </h1>
        <p className="text-xl md:text-2xl text-gray-300 mb-12 leading-relaxed font-light">
          Комплексная CRM-платформа для премиальных лаунжей. Оцифруйте базу гостей Jeremy’s Club, автоматизируйте сервис и увеличьте доход на 30% за счет повторных визитов.
        </p>
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6">
          <button className="bg-blue-600 hover:bg-blue-500 px-10 py-5 rounded-2xl text-lg font-bold transition-all shadow-xl shadow-blue-600/20 active:scale-95">
            Внедрить систему
          </button>
          <button className="bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-md px-10 py-5 rounded-2xl text-lg font-bold transition-all active:scale-95">
            Посмотреть презентацию
          </button>
        </div>
      </div>
    </div>
  </section>
);

const AboutZaraya = () => (
  <section id="about" className="py-24 bg-white">
    <div className="max-w-7xl mx-auto px-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        <div>
          <h2 className="text-4xl font-bold mb-8 leading-tight text-slate-900">Система «ЗАРЯ» — это интеллект <br /> вашего бизнеса</h2>
          <p className="text-gray-600 text-lg mb-10 leading-relaxed">
            Мы не просто устанавливаем софт. Мы внедряем систему управления гостевым опытом, которая превращает разовых посетителей в лояльных резидентов Jeremy’s Club. 
          </p>
          <div className="grid grid-cols-2 gap-8">
            <div className="p-6 border border-gray-100 rounded-[2rem] bg-gray-50/50">
              <div className="text-4xl font-black text-blue-600 mb-2">+30%</div>
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Средний рост дохода</div>
            </div>
            <div className="p-6 border border-gray-100 rounded-[2rem] bg-gray-50/50">
              <div className="text-4xl font-black text-blue-600 mb-2">+45%</div>
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Возвратность гостей</div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { icon: Users, title: "Guest 360", text: "Полная оцифровка профилей гостей и их предпочтений." },
            { icon: MessageSquare, title: "Smart WA", text: "Автоматическая коммуникация через WhatsApp." },
            { icon: TrendingUp, title: "Data Driven", text: "Принятие решений на основе реальных цифр, а не интуиции." },
            { icon: ShieldCheck, title: "Контроль сервиса", text: "Прозрачность работы персонала на каждом этапе." }
          ].map((item, idx) => (
            <div key={idx} className="p-8 bg-white border border-gray-100 rounded-[2.5rem] hover:shadow-2xl hover:shadow-blue-600/5 transition-all group border-b-4 border-b-transparent hover:border-b-blue-600">
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <item.icon className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-bold text-xl mb-3">{item.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

const Features = () => (
  <section id="features" className="py-24 bg-gray-50/50">
    <div className="max-w-7xl mx-auto px-6">
      <div className="text-center mb-20">
        <h2 className="text-5xl font-bold mb-6 text-slate-900 tracking-tight">Что изменится в Jeremy’s Club</h2>
        <p className="text-gray-500 max-w-2xl mx-auto text-lg">Конкретные инструменты для повышения качества сервиса и среднего чека.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100 hover:shadow-xl transition-shadow">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-8">
            <Users className="text-blue-600 w-9 h-9" />
          </div>
          <h3 className="text-2xl font-bold mb-6 text-slate-900">Цифровая база гостей</h3>
          <ul className="space-y-4 text-gray-600">
            <li className="flex items-start"><CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 shrink-0" /> История визитов и заказов</li>
            <li className="flex items-start"><CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 shrink-0" /> Любимые чаши и крепость</li>
            <li className="flex items-start"><CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 shrink-0" /> Сегментация по лояльности</li>
          </ul>
        </div>

        <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100 hover:shadow-xl transition-shadow">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-8">
            <Smartphone className="text-blue-600 w-9 h-9" />
          </div>
          <h3 className="text-2xl font-bold mb-6 text-slate-900">Smart-коммуникация</h3>
          <ul className="space-y-4 text-gray-600">
            <li className="flex items-start"><CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 shrink-0" /> Авто-поздравления с ДР</li>
            <li className="flex items-start"><CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 shrink-0" /> Сбор отзывов после визита</li>
            <li className="flex items-start"><CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 shrink-0" /> WhatsApp триггеры на возврат</li>
          </ul>
        </div>

        <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100 hover:shadow-xl transition-shadow">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-8">
            <Calendar className="text-blue-600 w-9 h-9" />
          </div>
          <h3 className="text-2xl font-bold mb-6 text-slate-900">Система бронирования</h3>
          <ul className="space-y-4 text-gray-600">
            <li className="flex items-start"><CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 shrink-0" /> Интерактивная карта столов</li>
            <li className="flex items-start"><CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 shrink-0" /> Исключение овербукинга</li>
            <li className="flex items-start"><CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 shrink-0" /> Профили столов и зон</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
);

const Importance = () => (
  <section className="py-24 bg-white border-y border-gray-100">
    <div className="max-w-7xl mx-auto px-6 text-center">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-4xl font-bold mb-8 text-slate-900 tracking-tight">Почему это критично для лаунжа в Москве?</h2>
        <p className="text-xl text-gray-600 mb-12 leading-relaxed">
          В условиях высочайшей конкуренции Москвы побеждает не тот, у кого лучше дизайн, а тот, кто лучше знает своего гостя. Персонализированный сервис — единственный способ удержать требовательную аудиторию. CRM «ЗАРЯ» превращает сервис в Jeremy’s Club в точный математический процесс роста прибыли.
        </p>
        <div className="inline-flex items-center space-x-3 text-blue-600 font-bold text-lg hover:translate-x-2 transition-transform cursor-pointer">
          <span>Узнать больше о методологии</span>
          <ChevronRight className="w-6 h-6" />
        </div>
      </div>
    </div>
  </section>
);

const Pricing = () => (
  <section id="pricing" className="py-24 bg-gray-50/50">
    <div className="max-w-7xl mx-auto px-6">
      <div className="text-center mb-20">
        <h2 className="text-5xl font-bold mb-6 text-slate-900 tracking-tight">Тарифные планы</h2>
        <p className="text-gray-500 text-lg">Выберите оптимальный уровень автоматизации для вашего бизнеса.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 items-end">
        {[
          {
            name: "Базовый",
            price: "16 000",
            desc: "Фундамент для управления гостями",
            features: ["Система лояльности", "Сервис бронирования", "Электронная база", "Базовая аналитика"]
          },
          {
            name: "Стандарт",
            price: "18 500",
            desc: "Цифровой сервис и удобство",
            features: ["Все из Базового", "QR-меню", "Заказ со стола", "Вызов официанта", "Интеграция с POS"]
          },
          {
            name: "Максимум",
            price: "26 000",
            desc: "Полный автопилот вашего бизнеса",
            popular: true,
            features: ["Все из Стандарта", "WA-триггеры после визита", "Умный рекомендатор официанту", "Сбор отзывов и оценка блюд", "Глубокая сквозная аналитика"]
          }
        ].map((plan, idx) => (
          <div key={idx} className={`bg-white p-10 rounded-[3rem] border ${plan.popular ? 'border-blue-600 shadow-2xl scale-105 relative z-10' : 'border-gray-100'} flex flex-col transition-all duration-500 hover:-translate-y-2`}>
            {plan.popular && <span className="absolute -top-5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-black px-5 py-2 rounded-full uppercase tracking-[0.2em] shadow-lg shadow-blue-600/30">Бестселлер</span>}
            <h3 className="text-2xl font-bold mb-3 text-slate-900">{plan.name}</h3>
            <div className="flex items-baseline mb-3">
              <span className="text-5xl font-black tracking-tight text-slate-900">{plan.price}</span>
              <span className="text-gray-400 font-bold ml-2">₽ / мес</span>
            </div>
            <p className="text-gray-400 text-sm font-medium mb-10">{plan.desc}</p>
            <div className="flex-1 space-y-5 mb-10">
              {plan.features.map((f, i) => (
                <div key={i} className="flex items-center text-sm font-semibold text-slate-700">
                  <div className="w-6 h-6 bg-blue-50 rounded-full flex items-center justify-center mr-4 shrink-0">
                    <CheckCircle className="w-4 h-4 text-blue-600" />
                  </div>
                  {f}
                </div>
              ))}
            </div>
            <button className={`w-full py-5 rounded-[1.5rem] font-bold text-base transition-all active:scale-95 ${plan.popular ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-xl shadow-blue-600/20' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
              Выбрать тариф
            </button>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const Implementation = () => (
  <section className="py-24 bg-white overflow-hidden">
    <div className="max-w-7xl mx-auto px-6">
      <div className="text-center mb-20">
        <h2 className="text-5xl font-bold mb-6 text-slate-900 tracking-tight">Процесс внедрения</h2>
        <p className="text-gray-500 text-lg">Запустим систему за 14 дней без остановки работы заведения.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-12 relative">
        {[
          { step: "01", title: "Анализ", text: "Аудит текущих процессов и настройка воронки гостя." },
          { step: "02", title: "Настройка", text: "Кастомизация CRM под бренд-бук Jeremy’s Club." },
          { step: "03", title: "Обучение", text: "Тренинги для персонала и администраторов." },
          { step: "04", title: "Запуск", text: "Финальное тестирование и переход в боевой режим." }
        ].map((item, idx) => (
          <div key={idx} className="relative group">
            <div className="text-7xl font-black text-gray-50 mb-6 group-hover:text-blue-50 transition-colors duration-500 select-none">{item.step}</div>
            <h4 className="text-xl font-bold mb-3 text-slate-900">{item.title}</h4>
            <p className="text-sm text-gray-500 leading-relaxed font-medium">{item.text}</p>
            {idx < 3 && <div className="hidden md:block absolute top-10 -right-6 w-12 border-t-2 border-dashed border-gray-100"></div>}
          </div>
        ))}
      </div>
    </div>
  </section>
);

const Footer = () => (
  <footer className="bg-slate-900 text-white py-24 relative overflow-hidden">
    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600"></div>
    <div className="max-w-7xl mx-auto px-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 mb-20">
        <div>
          <h2 className="text-5xl font-bold mb-8 leading-[1.1] tracking-tight">Готовы к новому уровню <br /> Jeremy’s Club?</h2>
          <p className="text-gray-400 text-xl mb-12 font-light max-w-lg">Оставьте заявку сегодня и получите бесплатный аудит вашей текущей базы гостей.</p>
          <div className="space-y-6">
            <div className="flex items-center space-x-5">
              <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center">
                <Target className="w-7 h-7 text-blue-400" />
              </div>
              <span className="text-gray-300 italic text-lg leading-snug">"Мы не продаем софт. Мы продаем <br className="hidden sm:block" /> осязаемый результат."</span>
            </div>
          </div>
        </div>
        <div className="bg-white/5 p-12 rounded-[3.5rem] border border-white/10 backdrop-blur-xl">
          <h3 className="text-3xl font-bold mb-10">Заявка на внедрение</h3>
          <div className="space-y-6">
            <div className="group">
              <input type="text" placeholder="Ваше имя" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all font-medium" />
            </div>
            <div className="group">
              <input type="tel" placeholder="Телефон" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all font-medium" />
            </div>
            <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black text-lg py-6 rounded-2xl transition-all shadow-2xl shadow-blue-600/30 active:scale-[0.98]">
              Начать внедрение
            </button>
          </div>
        </div>
      </div>
      <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-sm font-semibold text-gray-500 uppercase tracking-widest">
        <div className="mb-6 md:mb-0">© 2024 ЗАРЯ Системс. Премиум CRM.</div>
        <div className="flex space-x-10">
          <a href="https://zarayasystems.ru" className="hover:text-blue-400 transition-colors">Сайт компании</a>
          <a href="#" className="hover:text-blue-400 transition-colors">Техподдержка</a>
        </div>
      </div>
    </div>
  </footer>
);

export default function App() {
  return (
    <div className="min-h-screen selection:bg-blue-600 selection:text-white">
      <Header />
      <Hero />
      <AboutZaraya />
      <Features />
      <Importance />
      <Pricing />
      <Implementation />
      <Footer />
    </div>
  );
}
