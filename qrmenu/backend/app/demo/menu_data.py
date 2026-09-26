"""Demo menu of a Vietnamese café in six languages. Prices are in VND (no minor units)."""

RESTAURANT_NAME = {
    "vi": "Lão Đại",
    "en": "Lao Dai",
    "ru": "Лао Дай",
    "ja": "ラオ・ダイ",
    "ko": "라오 다이",
    "zh": "老大",
}

TAGLINE = {
    "vi": "Ẩm thực Việt Nam",
    "en": "Vietnamese cuisine",
    "ru": "Вьетнамская кухня",
    "ja": "ベトナム料理",
    "ko": "베트남 요리",
    "zh": "越南菜",
}

MODIFIER_GROUPS = {
    "toppings": {
        "name": {"vi": "Thêm topping", "en": "Extra toppings", "ru": "Топпинги", "ja": "トッピング", "ko": "토핑 추가", "zh": "加料"},
        "min": 0,
        "max": 3,
        "modifiers": [
            ({"vi": "Phô mai feta", "en": "Feta cheese", "ru": "Сыр фета", "ja": "フェタチーズ", "ko": "페타 치즈", "zh": "菲达奶酪"}, 15000),
            ({"vi": "Thịt xông khói", "en": "Bacon", "ru": "Бекон", "ja": "ベーコン", "ko": "베이컨", "zh": "培根"}, 20000),
            ({"vi": "Bơ", "en": "Avocado", "ru": "Авокадо", "ja": "アボカド", "ko": "아보카도", "zh": "牛油果"}, 25000),
        ],
    },
    "sugar": {
        "name": {"vi": "Mức đường", "en": "Sweetness", "ru": "Сахар", "ja": "甘さ", "ko": "당도", "zh": "甜度"},
        "min": 1,
        "max": 1,
        "modifiers": [
            ({"vi": "Bình thường", "en": "Regular", "ru": "Обычно", "ja": "普通", "ko": "보통", "zh": "正常"}, 0),
            ({"vi": "Ít đường", "en": "Less sugar", "ru": "Меньше сахара", "ja": "甘さ控えめ", "ko": "덜 달게", "zh": "少糖"}, 0),
            ({"vi": "Không đường", "en": "No sugar", "ru": "Без сахара", "ja": "砂糖なし", "ko": "무설탕", "zh": "无糖"}, 0),
        ],
    },
    "milk": {
        "name": {"vi": "Loại sữa", "en": "Milk", "ru": "Молоко", "ja": "ミルク", "ko": "우유 선택", "zh": "奶类"},
        "min": 0,
        "max": 1,
        "modifiers": [
            ({"vi": "Sữa yến mạch", "en": "Oat milk", "ru": "Овсяное молоко", "ja": "オーツミルク", "ko": "귀리 우유", "zh": "燕麦奶"}, 10000),
            ({"vi": "Sữa dừa", "en": "Coconut milk", "ru": "Кокосовое молоко", "ja": "ココナッツミルク", "ko": "코코넛 밀크", "zh": "椰奶"}, 10000),
        ],
    },
    "pho_extra": {
        "name": {"vi": "Thêm", "en": "Add-ons", "ru": "Добавки", "ja": "追加", "ko": "추가", "zh": "加点"},
        "min": 0,
        "max": 3,
        "modifiers": [
            ({"vi": "Thêm thịt bò", "en": "Extra beef", "ru": "Больше говядины", "ja": "牛肉増量", "ko": "소고기 추가", "zh": "加牛肉"}, 25000),
            ({"vi": "Trứng chần", "en": "Poached egg", "ru": "Яйцо пашот", "ja": "ポーチドエッグ", "ko": "수란", "zh": "水波蛋"}, 10000),
            ({"vi": "Quẩy", "en": "Fried dough sticks", "ru": "Жареные палочки из теста", "ja": "揚げパン", "ko": "꽈배기 튀김", "zh": "油条"}, 5000),
        ],
    },
}

# (key, names, schedule) — schedule is (from, to) local time or None
CATEGORIES = [
    ("eggs", {"vi": "Trứng", "en": "Eggs", "ru": "Яйца", "ja": "卵料理", "ko": "달걀 요리", "zh": "蛋类"}, None),
    ("banhmi", {"vi": "Bánh mì & Toast", "en": "Bánh mì & toasts", "ru": "Бань ми и тосты", "ja": "バインミー＆トースト", "ko": "반미 & 토스트", "zh": "越南法棍和吐司"}, None),
    ("noodles", {"vi": "Phở & Bún", "en": "Phở & noodles", "ru": "Фо и лапша", "ja": "フォー＆麺", "ko": "쌀국수", "zh": "河粉和米线"}, None),
    ("coffee", {"vi": "Cà phê", "en": "Coffee", "ru": "Кофе", "ja": "コーヒー", "ko": "커피", "zh": "咖啡"}, None),
    ("drinks", {"vi": "Trà & Nước ép", "en": "Tea & juices", "ru": "Чай и соки", "ja": "お茶＆ジュース", "ko": "차 & 주스", "zh": "茶和果汁"}, None),
    ("desserts", {"vi": "Tráng miệng", "en": "Desserts", "ru": "Десерты", "ja": "デザート", "ko": "디저트", "zh": "甜品"}, None),
    ("evening", {"vi": "Món đặc biệt buổi tối", "en": "Evening specials", "ru": "Вечернее меню", "ja": "夜の特別メニュー", "ko": "저녁 스페셜", "zh": "晚间特色菜"}, ("17:00", "22:30")),
]

# key, category, name, description, prices [(variant name | None, amount)], badges, groups, image style
ITEMS = [
    (
        "shak_green", "eggs",
        {"vi": "Shakshuka xanh", "en": "Green shakshuka", "ru": "Шакшука зелёная", "ja": "グリーン・シャクシュカ", "ko": "그린 샥슈카", "zh": "绿色北非蛋"},
        {"vi": "Rau bina, đậu Hà Lan, bông cải xanh và phô mai feta, kèm bánh mì nướng", "en": "Spinach, peas, broccoli and feta, served with toasted bread", "ru": "Шпинат, горошек, брокколи и фета, подаётся с поджаренным хлебом", "ja": "ほうれん草、グリーンピース、ブロッコリー、フェタチーズ。トースト付き", "ko": "시금치, 완두콩, 브로콜리, 페타 치즈와 구운 빵", "zh": "菠菜、豌豆、西兰花和菲达奶酪，配烤面包"},
        [({"vi": "Thường", "en": "Regular", "ru": "Обычная", "ja": "レギュラー", "ko": "보통", "zh": "常规"}, 75000), ({"vi": "Lớn", "en": "Large", "ru": "Большая", "ja": "ラージ", "ko": "큰 사이즈", "zh": "大份"}, 95000)],
        ["hit", "vegetarian"], ["toppings"], "green",
    ),
    (
        "shak_red", "eggs",
        {"vi": "Shakshuka đỏ", "en": "Red shakshuka", "ru": "Шакшука красная", "ja": "レッド・シャクシュカ", "ko": "레드 샥슈카", "zh": "红色北非蛋"},
        {"vi": "Cà chua, ớt chuông, thì là Ai Cập, trứng chần trong chảo gang", "en": "Tomatoes, bell peppers and cumin with eggs baked in a cast-iron pan", "ru": "Томаты, сладкий перец, кумин, яйца в чугунной сковороде", "ja": "トマト、パプリカ、クミンと卵を鉄鍋で", "ko": "토마토, 파프리카, 커민과 무쇠팬에 구운 달걀", "zh": "番茄、甜椒、孜然，铸铁锅烤蛋"},
        [(None, 75000)], ["spicy"], ["toppings"], "red",
    ),
    (
        "fried_eggs", "eggs",
        {"vi": "Trứng ốp la giòn", "en": "Crispy fried eggs", "ru": "Хрустящая яичница", "ja": "カリカリ目玉焼き", "ko": "바삭한 달걀 프라이", "zh": "脆边煎蛋"},
        {"vi": "Hai trứng ốp la viền giòn, xúc xích và salad", "en": "Two crispy-edged eggs with sausage and salad", "ru": "Два яйца с хрустящими краями, колбаски и салат", "ja": "縁がカリッとした目玉焼き2つ、ソーセージとサラダ", "ko": "바삭한 달걀 2개, 소시지와 샐러드", "zh": "两个脆边煎蛋，配香肠和沙拉"},
        [(None, 65000)], [], ["toppings"], "eggs",
    ),
    (
        "benedict", "eggs",
        {"vi": "Trứng Benedict", "en": "Eggs Benedict", "ru": "Яйца Бенедикт", "ja": "エッグベネディクト", "ko": "에그 베네딕트", "zh": "班尼迪克蛋"},
        {"vi": "Trứng chần, sốt hollandaise, jambon trên bánh muffin", "en": "Poached eggs, hollandaise and ham on an English muffin", "ru": "Яйца пашот, голландский соус и ветчина на маффине", "ja": "ポーチドエッグ、オランデーズソース、ハム、イングリッシュマフィン", "ko": "수란, 홀랜다이즈 소스, 햄, 잉글리시 머핀", "zh": "水波蛋、荷兰酱和火腿配英式松饼"},
        [(None, 89000)], ["new"], [], "eggs",
    ),
    (
        "banhmi_pork", "banhmi",
        {"vi": "Bánh mì thịt nướng", "en": "Grilled pork bánh mì", "ru": "Бань ми с жареной свининой", "ja": "焼き豚バインミー", "ko": "숯불 돼지고기 반미", "zh": "烤猪肉法棍"},
        {"vi": "Thịt heo nướng sả, pate, đồ chua, rau mùi", "en": "Lemongrass pork, pâté, pickles and coriander", "ru": "Свинина с лемонграссом, паштет, маринованные овощи, кинза", "ja": "レモングラス焼き豚、パテ、なます、パクチー", "ko": "레몬그라스 돼지고기, 파테, 절임 채소, 고수", "zh": "香茅烤猪肉、肝酱、腌菜和香菜"},
        [(None, 45000)], ["hit"], [], "toast",
    ),
    (
        "banhmi_egg", "banhmi",
        {"vi": "Bánh mì ốp la", "en": "Fried egg bánh mì", "ru": "Бань ми с яичницей", "ja": "目玉焼きバインミー", "ko": "달걀 반미", "zh": "煎蛋法棍"},
        {"vi": "Trứng ốp la, xì dầu, dưa leo, ớt", "en": "Fried eggs, soy sauce, cucumber and chilli", "ru": "Яичница, соевый соус, огурец, чили", "ja": "目玉焼き、醤油、きゅうり、唐辛子", "ko": "달걀 프라이, 간장, 오이, 고추", "zh": "煎蛋、酱油、黄瓜和辣椒"},
        [(None, 35000)], [], ["toppings"], "eggs",
    ),
    (
        "avo_toast", "banhmi",
        {"vi": "Toast bơ", "en": "Avocado toast", "ru": "Тост с авокадо", "ja": "アボカドトースト", "ko": "아보카도 토스트", "zh": "牛油果吐司"},
        {"vi": "Bánh mì men tự nhiên, bơ dầm, cà chua bi, hạt bí", "en": "Sourdough, smashed avocado, cherry tomatoes and pumpkin seeds", "ru": "Хлеб на закваске, авокадо, черри, тыквенные семечки", "ja": "サワードウ、アボカド、ミニトマト、かぼちゃの種", "ko": "사워도우, 으깬 아보카도, 방울토마토, 호박씨", "zh": "酸面包、牛油果泥、小番茄和南瓜子"},
        [(None, 85000)], ["vegan"], ["toppings"], "avotoast",
    ),
    (
        "pho_bo", "noodles",
        {"vi": "Phở bò", "en": "Beef phở", "ru": "Фо бо с говядиной", "ja": "牛肉のフォー", "ko": "소고기 쌀국수", "zh": "牛肉河粉"},
        {"vi": "Nước dùng hầm 12 tiếng, bò tái, rau thơm", "en": "12-hour broth, rare beef and fresh herbs", "ru": "Бульон 12 часов, нежная говядина, свежая зелень", "ja": "12時間煮込んだスープ、レア牛肉、ハーブ", "ko": "12시간 끓인 육수, 소고기, 향채", "zh": "熬制12小时的汤底、嫩牛肉和香草"},
        [({"vi": "Tô vừa", "en": "Regular bowl", "ru": "Обычная", "ja": "並", "ko": "보통", "zh": "中碗"}, 65000), ({"vi": "Tô lớn", "en": "Large bowl", "ru": "Большая", "ja": "大盛り", "ko": "곱빼기", "zh": "大碗"}, 85000)],
        ["hit"], ["pho_extra"], "pho",
    ),
    (
        "bun_cha", "noodles",
        {"vi": "Bún chả Hà Nội", "en": "Hanoi bún chả", "ru": "Бун ча по-ханойски", "ja": "ハノイ風ブンチャー", "ko": "하노이 분짜", "zh": "河内烤肉米线"},
        {"vi": "Chả nướng than hoa, bún, nước mắm chua ngọt", "en": "Charcoal-grilled pork, rice noodles and sweet fish sauce", "ru": "Свинина на углях, рисовая лапша, кисло-сладкий соус", "ja": "炭火焼き豚、米麺、甘酸っぱいヌクマム", "ko": "숯불 돼지고기, 쌀국수, 새콤달콤 느억맘", "zh": "炭烤猪肉、米线和酸甜鱼露"},
        [(None, 70000)], [], [], "pho",
    ),
    (
        "bun_hue", "noodles",
        {"vi": "Bún bò Huế", "en": "Huế spicy beef noodles", "ru": "Бун бо Хюэ", "ja": "ブンボーフエ", "ko": "분보후에", "zh": "顺化牛肉米线"},
        {"vi": "Nước dùng sả ớt cay, bò và giò heo", "en": "Spicy lemongrass broth with beef and pork", "ru": "Острый бульон с лемонграссом, говядина и свинина", "ja": "レモングラスの辛いスープ、牛肉と豚肉", "ko": "매콤한 레몬그라스 육수, 소고기와 돼지고기", "zh": "香茅辣汤、牛肉和猪蹄"},
        [(None, 70000)], ["spicy"], ["pho_extra"], "red",
    ),
    (
        "ca_phe_sua_da", "coffee",
        {"vi": "Cà phê sữa đá", "en": "Iced coffee with condensed milk", "ru": "Кофе со сгущёнкой и льдом", "ja": "ベトナム式アイスミルクコーヒー", "ko": "연유 아이스커피", "zh": "越南冰奶咖啡"},
        {"vi": "Robusta phin truyền thống với sữa đặc", "en": "Traditional phin-dripped robusta with condensed milk", "ru": "Робуста через фин со сгущённым молоком", "ja": "フィンで淹れたロブスタと練乳", "ko": "핀으로 내린 로부스타와 연유", "zh": "传统滴滤罗布斯塔配炼乳"},
        [(None, 35000)], ["hit"], ["sugar"], "coffee",
    ),
    (
        "egg_coffee", "coffee",
        {"vi": "Cà phê trứng", "en": "Egg coffee", "ru": "Яичный кофе", "ja": "エッグコーヒー", "ko": "에그 커피", "zh": "鸡蛋咖啡"},
        {"vi": "Kem trứng đánh bông trên cà phê nóng, kiểu Hà Nội", "en": "Whipped egg cream over hot coffee, Hanoi style", "ru": "Взбитый яичный крем на горячем кофе, по-ханойски", "ja": "ホットコーヒーに泡立てた卵クリーム、ハノイ風", "ko": "뜨거운 커피 위 달걀 크림, 하노이 스타일", "zh": "热咖啡上的打发蛋奶油，河内风味"},
        [(None, 45000)], ["new"], [], "coffee",
    ),
    (
        "bac_xiu", "coffee",
        {"vi": "Bạc xỉu", "en": "Bạc xỉu (milky coffee)", "ru": "Бак сиу (кофе с молоком)", "ja": "バックシウ（ミルクコーヒー）", "ko": "박씨우 (밀크 커피)", "zh": "白咖啡（越式奶咖）"},
        {"vi": "Nhiều sữa, ít cà phê", "en": "Lots of milk, a little coffee", "ru": "Много молока, немного кофе", "ja": "ミルクたっぷり、コーヒー少なめ", "ko": "우유 많이, 커피 조금", "zh": "奶多咖啡少"},
        [(None, 39000)], [], ["sugar", "milk"], "coffee",
    ),
    (
        "americano", "coffee",
        {"vi": "Americano", "en": "Americano", "ru": "Американо", "ja": "アメリカーノ", "ko": "아메리카노", "zh": "美式咖啡"},
        {"vi": "Arabica Đà Lạt", "en": "Da Lat arabica", "ru": "Арабика из Далата", "ja": "ダラット産アラビカ", "ko": "달랏 아라비카", "zh": "大叻阿拉比卡"},
        [({"vi": "Nóng", "en": "Hot", "ru": "Горячий", "ja": "ホット", "ko": "핫", "zh": "热"}, 40000), ({"vi": "Đá", "en": "Iced", "ru": "Со льдом", "ja": "アイス", "ko": "아이스", "zh": "冰"}, 45000)],
        [], ["milk"], "coffee",
    ),
    (
        "peach_tea", "drinks",
        {"vi": "Trà đào cam sả", "en": "Peach, orange and lemongrass tea", "ru": "Персиковый чай с апельсином и лемонграссом", "ja": "桃とオレンジとレモングラスのお茶", "ko": "복숭아 오렌지 레몬그라스 차", "zh": "蜜桃橙子香茅茶"},
        {"vi": "Trà đen, đào ngâm, cam tươi, sả", "en": "Black tea, peaches, fresh orange and lemongrass", "ru": "Чёрный чай, персики, апельсин, лемонграсс", "ja": "紅茶、桃、オレンジ、レモングラス", "ko": "홍차, 복숭아, 오렌지, 레몬그라스", "zh": "红茶、蜜桃、鲜橙和香茅"},
        [(None, 45000)], ["hit"], ["sugar"], "juice",
    ),
    (
        "orange_juice", "drinks",
        {"vi": "Nước ép cam", "en": "Fresh orange juice", "ru": "Свежевыжатый апельсиновый сок", "ja": "フレッシュオレンジジュース", "ko": "생오렌지 주스", "zh": "鲜榨橙汁"},
        {"vi": "Cam sành Vĩnh Long", "en": "Vinh Long oranges", "ru": "Апельсины из Виньлонга", "ja": "ヴィンロン産オレンジ", "ko": "빈롱 오렌지", "zh": "永隆橙"},
        [(None, 45000)], ["vegan"], [], "juice",
    ),
    (
        "avo_smoothie", "drinks",
        {"vi": "Sinh tố bơ", "en": "Avocado smoothie", "ru": "Смузи из авокадо", "ja": "アボカドスムージー", "ko": "아보카도 스무디", "zh": "牛油果奶昔"},
        {"vi": "Bơ sáp, sữa đặc, đá xay", "en": "Creamy avocado, condensed milk and crushed ice", "ru": "Авокадо, сгущённое молоко, колотый лёд", "ja": "アボカド、練乳、クラッシュアイス", "ko": "아보카도, 연유, 간 얼음", "zh": "牛油果、炼乳和碎冰"},
        [(None, 50000)], [], ["sugar"], "avotoast",
    ),
    (
        "che", "desserts",
        {"vi": "Chè ba màu", "en": "Three-colour dessert", "ru": "Че «три цвета»", "ja": "三色チェー", "ko": "쩨 (삼색 디저트)", "zh": "三色甜汤"},
        {"vi": "Đậu xanh, đậu đỏ, thạch lá dứa và nước cốt dừa", "en": "Mung beans, red beans, pandan jelly and coconut milk", "ru": "Маш, красная фасоль, желе из пандана, кокосовое молоко", "ja": "緑豆、小豆、パンダンゼリー、ココナッツミルク", "ko": "녹두, 팥, 판단 젤리, 코코넛 밀크", "zh": "绿豆、红豆、班兰果冻和椰奶"},
        [(None, 35000)], ["vegan"], [], "cake",
    ),
    (
        "flan", "desserts",
        {"vi": "Bánh flan", "en": "Crème caramel", "ru": "Флан (крем-карамель)", "ja": "プリン", "ko": "플랑 (커스터드 푸딩)", "zh": "焦糖布丁"},
        {"vi": "Flan caramel với cà phê", "en": "Caramel flan with a splash of coffee", "ru": "Карамельный флан с каплей кофе", "ja": "コーヒーをかけたカラメルプリン", "ko": "커피를 곁들인 캐러멜 플랑", "zh": "淋咖啡的焦糖布丁"},
        [(None, 30000)], [], [], "cake",
    ),
    (
        "cheesecake", "desserts",
        {"vi": "Cheesecake chanh dây", "en": "Passion fruit cheesecake", "ru": "Чизкейк с маракуйей", "ja": "パッションフルーツのチーズケーキ", "ko": "패션프루트 치즈케이크", "zh": "百香果芝士蛋糕"},
        {"vi": "Nướng kiểu New York, sốt chanh dây", "en": "New York style with passion fruit sauce", "ru": "Нью-йоркский, с соусом из маракуйи", "ja": "ニューヨークスタイル、パッションフルーツソース", "ko": "뉴욕 스타일, 패션프루트 소스", "zh": "纽约风格，配百香果酱"},
        [(None, 55000)], ["new"], [], "cake",
    ),
    (
        "hotpot", "evening",
        {"vi": "Lẩu Thái hải sản", "en": "Thai seafood hotpot", "ru": "Тайский хот-пот с морепродуктами", "ja": "タイ風シーフード鍋", "ko": "태국식 해산물 전골", "zh": "泰式海鲜火锅"},
        {"vi": "Tôm, mực, nghêu, nấm; cho 2–3 người", "en": "Prawns, squid, clams and mushrooms; for 2–3 people", "ru": "Креветки, кальмар, моллюски, грибы; на 2–3 персоны", "ja": "エビ、イカ、アサリ、きのこ。2〜3人前", "ko": "새우, 오징어, 조개, 버섯; 2–3인분", "zh": "虾、鱿鱼、蛤蜊和蘑菇，2–3人份"},
        [(None, 250000)], ["spicy"], [], "red",
    ),
    (
        "spring_rolls", "evening",
        {"vi": "Gỏi cuốn tôm thịt", "en": "Fresh spring rolls", "ru": "Свежие спринг-роллы", "ja": "生春巻き", "ko": "월남쌈", "zh": "越南鲜春卷"},
        {"vi": "Tôm, thịt, bún, rau sống, sốt đậu phộng", "en": "Prawns, pork, noodles, herbs and peanut sauce", "ru": "Креветки, свинина, лапша, зелень, арахисовый соус", "ja": "エビ、豚肉、ビーフン、ハーブ、ピーナッツソース", "ko": "새우, 돼지고기, 쌀국수, 채소, 땅콩 소스", "zh": "虾、猪肉、米粉、生菜和花生酱"},
        [(None, 60000)], [], [], "green",
    ),
]

# How likely each dish is at a part of the day (relative weights) — shapes the demo history
DAYPART_WEIGHTS = {
    "morning": {"eggs": 5, "banhmi": 5, "coffee": 6, "drinks": 2, "noodles": 3, "desserts": 0.5, "evening": 0},
    "lunch": {"eggs": 1.5, "banhmi": 3, "coffee": 3, "drinks": 3, "noodles": 7, "desserts": 1, "evening": 0},
    "afternoon": {"eggs": 1, "banhmi": 2, "coffee": 5, "drinks": 5, "noodles": 2, "desserts": 5, "evening": 0},
    "evening": {"eggs": 0.5, "banhmi": 1, "coffee": 1.5, "drinks": 4, "noodles": 4, "desserts": 3, "evening": 6},
    "night": {"eggs": 0.5, "banhmi": 2, "coffee": 1, "drinks": 4, "noodles": 3, "desserts": 3, "evening": 0},
}

# Guests of different languages lean towards different dishes
LANGUAGE_TASTE = {
    "vi": {"noodles": 1.4, "coffee": 1.3, "banhmi": 1.2, "eggs": 0.6},
    "en": {"eggs": 1.6, "avo_toast": 2.0, "americano": 2.0, "egg_coffee": 1.5},
    "ru": {"shak_green": 2.5, "shak_red": 2.0, "cheesecake": 2.0, "pho_bo": 1.3},
    "ja": {"egg_coffee": 3.0, "flan": 2.5, "spring_rolls": 2.0},
    "ko": {"ca_phe_sua_da": 2.5, "banhmi_pork": 2.2, "hotpot": 2.0, "avo_smoothie": 2.0},
    "zh": {"pho_bo": 2.2, "hotpot": 2.5, "peach_tea": 2.0, "bun_hue": 1.5},
}

LANGUAGE_SHARE = {"vi": 42, "en": 22, "ko": 11, "ru": 9, "zh": 9, "ja": 7}

# Relative number of orders per local hour
HOUR_WEIGHTS = {
    7: 2, 8: 5, 9: 6, 10: 4, 11: 3, 12: 7, 13: 6, 14: 3, 15: 2, 16: 3,
    17: 4, 18: 6, 19: 8, 20: 6, 21: 3, 22: 1,
}
