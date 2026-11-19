/* =========================================================
   สองภาษา (ไทย / English) — ปุ่มสลับ TH/EN ที่หัวเว็บ
   - ภาษาที่เลือกเก็บไว้ในเบราว์เซอร์ (localStorage) · ลิงก์ ?lang=en / ?lang=th ก็ได้
   - โหมดอังกฤษ: ระบบแปลข้อความบนหน้าเว็บอัตโนมัติ ตามพจนานุกรม I18N_EN ด้านล่าง
     (ข้อความที่ตรงกับคำไทยทั้งก้อน → แปลง · ไม่ตรง → แสดงภาษาไทยเดิม)
   - เนื้อหาที่แอดมินพิมพ์ (ข่าว บทความ รายละเอียดพืช) ยังเป็นภาษาไทย ยกเว้นชื่อพืชที่มีชื่อภาษาอังกฤษ
   เพิ่มคำแปล: ใส่คู่ "ข้อความไทย": "English" ใน I18N_EN
   ========================================================= */
const LANG = (() => {
  try {
    const q = new URLSearchParams(location.search).get("lang");
    if (q === "en" || q === "th") { localStorage.setItem("lang", q); return q; }
    return localStorage.getItem("lang") === "en" ? "en" : "th";
  } catch (e) { return "th"; }
})();
document.documentElement.lang = LANG;
const IS_EN = LANG === "en";

const EN_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
/* เดือน/ปี ตามภาษา (ไทย: พ.ศ. · อังกฤษ: ค.ศ.) */
const monthName = m => IS_EN ? EN_MONTHS[m] : TH_MONTHS_I18N[m];
const yearDisp = y => IS_EN ? y : y + 543;
const TH_MONTHS_I18N = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
/* ชื่อพืชที่แสดงเป็นหัวข้อ: โหมดอังกฤษใช้ชื่อภาษาอังกฤษชื่อแรก (ถ้ามี) */
const herbTitle = h => IS_EN && h.en ? String(h.en).split(",")[0].trim() : h.th;

const I18N_EN = {
  /* ---- ชื่อเว็บ / แถบบน ---- */
  "สวนสมุนไพรสมเด็จพระเทพฯ": "Princess Sirindhorn Herb Garden",
  "สวนสมุนไพรสมเด็จพระเทพรัตนราชสุดาฯ สยามบรมราชกุมารี": "Her Royal Highness Princess Maha Chakri Sirindhorn Herb Garden",
  "เว็บไซต์ทดลอง": "Trial website",
  "(ต้นแบบเพื่อการศึกษา) — ไม่ใช่เว็บไซต์ทางการของสวนสมุนไพรฯ หรือ บริษัท ปตท. จำกัด (มหาชน) · ข้อมูลบางส่วนเป็นข้อมูลตัวอย่าง":
    "(a study prototype) — not the official website of the Herb Garden or PTT Public Company Limited · some information is sample data",
  "📴 ไม่มีอินเทอร์เน็ต — กำลังแสดงข้อมูลที่เคยเปิดไว้ในเครื่อง": "📴 No internet — showing information saved on this device",
  /* ---- เมนู ---- */
  "หน้าหลัก": "Home", "เกี่ยวกับเรา": "About Us", "ประวัติความเป็นมา": "History",
  "อาคารเฉลิมพระเกียรติ 50 พรรษา": "50th Birthday Anniversary Building", "รางวัลที่ได้รับ": "Awards",
  "สวนสมุนไพร": "Herb Garden", "ค้นหาสมุนไพร": "Herb Search", "บทความสมุนไพร": "Herb Articles",
  "แผนผังสวนสมุนไพร": "Garden Map", "ข่าวประชาสัมพันธ์": "News", "โบรชัวร์": "Brochures",
  "โครงการและกิจกรรม": "Projects & Activities", "ปฏิทินกิจกรรม": "Activity Calendar", "ติดต่อเรา": "Contact Us",
  "เมนู": "Menu", "ข้อมูลสวนสมุนไพร": "Herb Garden Info",
  "นโยบายคุกกี้": "Cookie Policy", "นโยบายคุกกี้และข้อมูลส่วนบุคคล": "Cookie & Privacy Policy",
  /* ---- หน้าแรก ---- */
  "มิติการเรียนรู้ด้านสมุนไพรไทย ศาสตร์แห่งภูมิปัญญาที่มีคุณค่าเอนกอนันต์": "A place to learn about Thai herbs and their invaluable traditional wisdom",
  "แหล่งรวบรวมพันธุ์สมุนไพรมากกว่า 509 ชนิด บนเนื้อที่ 60 ไร่": "Home to more than 509 herb species on 60 rai (about 24 acres)",
  "ข่าวสารล่าสุด": "Latest News", "ดูทั้งหมด": "View all", "บริการ": "Services",
  "สวนสมุนไพรสมเด็จพระเทพรัตนราชสุดาฯ สยามบรมราชกุมารี มีกิจกรรมต่าง ๆ มากมาย ให้นักท่องเที่ยว นักเรียน นักศึกษา หรือบุคคลทั่วไป ที่สนใจในสมุนไพรไทยเข้ามาศึกษาหาความรู้ท่ามกลางบรรยากาศร่มรื่นเต็มไปด้วยสมุนไพรหลากหลายชนิดโดยแบ่งเป็น 20 กลุ่มตามสรรพคุณรักษาโรค":
    "The Herb Garden offers many activities for visitors, students and anyone interested in Thai herbs, set in a shady garden full of herb species arranged into 20 groups by their medicinal properties.",
  "ก่อนหน้า": "Previous", "ถัดไป": "Next",
  "นอกจากเป็นแหล่งเรียนรู้สมุนไพรแล้ว สวนสมุนไพรสมเด็จพระเทพรัตนราชสุดาฯ สยามบรมราชกุมารี":
    "Besides being a place to learn about herbs, the Herb Garden",
  "ยังมีโครงการและกิจกรรมในด้านอื่น ๆ ที่น่าสนใจ อาทิ Wellness ,Sport Complex, ตลาดนัดชุมชน , งาน อพ.สธ. และ กิจกรรม Workshop":
    "also runs other projects and activities, such as Wellness, the Sport Complex, a community market, RSPG events and workshops",
  "สาธิตผลิตภัณฑ์จากสมุนไพร (Workshop)": "Herbal Product Workshops",
  "พันธุ์ไม้มงคลพระราชทานประจำจังหวัด (77 จังหวัด)": "Royal Auspicious Trees of the 77 Provinces",
  "บริการเยี่ยมชม": "Garden visits", "บริการรถนำเที่ยว": "Garden tram tours", "พร้อมเจ้าหน้าที่บรรยาย": "with a staff guide",
  "Workshop": "Workshop", "และสนามฟุตบอล": "& football pitch",
  "อ่านเพิ่มเติม": "Read more", "อ่านเพิ่มเติม →": "Read more →",
  /* ---- ส่วนท้าย / คุกกี้ ---- */
  "© ": "© ", "บริษัท ปตท. จำกัด (มหาชน) สงวนลิขสิทธิ์": "PTT Public Company Limited. All rights reserved.",
  "โทร": "Tel.",
  "เว็บไซต์นี้ใช้คุกกี้เพื่อมอบประสบการณ์การใช้งานเว็บไซต์และการปรับปรุงประสบการณ์การใช้งานของท่านให้ดียิ่งขึ้น ท่านสามารถศึกษาเกี่ยวกับ":
    "This website uses cookies to provide and improve your browsing experience. You can read our",
  "นโยบายข้อมูลส่วนบุคคลของเราและการใช้คุกกี้": "privacy and cookie policy",
  "การใช้งานเว็บไซต์นี้เป็นการยอมรับข้อกำหนดและยินยอมให้เราจัดเก็บคุกกี้ตามนโยบายที่แจ้งในเบื้องต้น":
    "— by using this website you accept these terms and allow us to store cookies as described.",
  "ไม่ตกลง": "Decline", "ตกลง": "Accept",
  /* ---- ข้อมูลติดต่อ (ค่าตั้งต้น) ---- */
  "39 ทางหลวงระยอง 3191 อ.นิคมพัฒนา จ.ระยอง 21180": "39 Rayong Highway 3191, Nikhom Phatthana District, Rayong 21180, Thailand",
  "สวนสมุนไพร อังคาร–อาทิตย์ 09.00–16.30 น. (ปิดวันจันทร์)": "Herb Garden: Tue–Sun 9:00–16:30 (closed Mondays)",
  "พื้นที่ออกกำลังกาย ทุกวัน 06.00–20.00 น.": "Exercise area: daily 6:00–20:00",
  "เข้าชมฟรี": "Free admission",
  /* ---- หน้าย่อยทั่วไป ---- */
  "ค้นหา": "Search", "ระบุคำค้นหา": "Enter a keyword", "ทั้งหมด": "All",
  "ไม่พบบทความ": "No articles found", "ไม่พบข่าวที่ค้นหา": "No news found", "ไม่พบข้อมูล": "No results",
  "ประเภทโบรชัวร์": "Brochure type", "แนะนำ": "Introduction", "แผนที่": "Map", "สมุนไพร": "Herbs", "กิจกรรม": "Activities",
  "ดาวน์โหลด PDF": "Download PDF", "ยังไม่มีไฟล์ให้ดาวน์โหลด": "No file available yet",
  "ข่าวสาร": "News", "โครงการ": "Project",
  "← กลับไปหน้าบทความ": "← Back to articles", "← กลับไปหน้าข่าวประชาสัมพันธ์": "← Back to news",
  "← กลับไปหน้าโครงการและกิจกรรม": "← Back to projects & activities",
  "กำลังโหลด…": "Loading…", "กำลังโหลดข้อมูลพืช…": "Loading plant information…", "ไม่พบข้อมูลพืชนี้": "Plant not found",
  "ขออภัย ไม่พบข้อมูลพืชตามลิงก์หรือป้าย QR นี้ ข้อมูลอาจถูกย้ายหรือปรับปรุงแล้ว":
    "Sorry, we couldn't find the plant for this link or QR label. It may have been moved or updated.",
  "ไปหน้าค้นหาสมุนไพร →": "Go to Herb Search →",
  "เนื้อหาตัวอย่าง": "Sample content",
  /* ---- ติดต่อเรา ---- */
  "ที่อยู่": "Address", "โทรศัพท์": "Phone", "อีเมล": "Email", "เวลาทำการ": "Opening hours",
  "ส่งข้อความถึงเรา": "Send us a message",
  "⚠ เว็บไซต์ทดลอง: ข้อความที่ส่งจะเก็บไว้ในระบบทดลองเท่านั้น": "⚠ Trial website: messages are only stored in this trial system and",
  "ไม่ถึงเจ้าหน้าที่ของสวนจริง": "do not reach the garden's staff",
  "ชื่อ-นามสกุล *": "Full name *", "เบอร์โทรศัพท์ *": "Phone number *", "หัวข้อ": "Topic", "รายละเอียด": "Details",
  "เยี่ยมชม/ศึกษาดูงาน": "Visit / study tour", "สอบถามข้อมูลสมุนไพร": "Herb information",
  "Sport Complex / จองสนามฟุตบอล": "Sport Complex / football pitch booking", "อื่นๆ": "Other",
  "ห้ามกรอกช่องนี้": "Leave this field empty",
  "ข้าพเจ้าได้อ่านและยอมรับนโยบายคุ้มครองข้อมูลส่วนบุคคล": "I have read and accept the privacy policy",
  "ส่งข้อความ": "Send message", "✓ ส่งข้อความเรียบร้อย เจ้าหน้าที่จะติดต่อกลับโดยเร็ว": "✓ Message sent. Our staff will contact you soon.",
  "กรุณากรอกชื่อและเบอร์โทรศัพท์": "Please enter your name and phone number",
  "เบอร์โทรศัพท์ไม่ถูกต้อง": "Invalid phone number",
  "ไม่อนุญาตให้ใส่ลิงก์หลายลิงก์ในข้อความ": "Messages may not contain several links",
  "ได้รับข้อความนี้แล้ว เจ้าหน้าที่จะติดต่อกลับโดยเร็ว": "We already received this message. Our staff will contact you soon.",
  "ยังไม่ได้รันเซิร์ฟเวอร์ (python server/server.py)": "The server is not running (python server/server.py)",
  "ส่งข้อความไม่สำเร็จ": "Could not send the message",
  /* ---- ค้นหาสมุนไพร ---- */
  "หมวดสมุนไพร": "Category", "กลุ่มสมุนไพร": "Herb group", "ภูมิภาค": "Region", "จังหวัด": "Province",
  "สถานะการอนุรักษ์": "Conservation status", "หัวข้อค้นหา": "Search in",
  "สมุนไพรตามสรรพคุณ": "Herbs by medicinal use",
  "พันธุ์ไม้มงคลพระราชทานประจำจังหวัด (77 จังหวัด) ": "Royal Auspicious Trees of the 77 Provinces",
  "พืชที่ต้องอนุรักษ์ (ทุกระดับ)": "Plants needing conservation (all levels)",
  "ชื่อภาษาไทย": "Thai name", "ชื่อภาษาอังกฤษ": "English name", "ชื่อวิทยาศาสตร์": "Scientific name", "สรรพคุณ": "Medicinal uses",
  "มุมมอง": "View", "🖼 รูปภาพ": "🖼 Photos", "☰ ตาราง": "☰ Table",
  "ลำดับ": "No.", "ลักษณะทั่วไป": "Description", "ปิด": "Close",
  "ไม่พบข้อมูลสมุนไพรที่ตรงกับเงื่อนไข": "No herbs match your filters",
  "* ข้อมูลตามภูมิปัญญาการแพทย์แผนไทย ควรปรึกษาแพทย์หรือเภสัชกรก่อนใช้":
    "* Based on traditional Thai medicine. Consult a doctor or pharmacist before use.",
  "* ข้อมูลตามภูมิปัญญาการแพทย์แผนไทย ไม่ใช่คำแนะนำทางการแพทย์ ควรปรึกษาแพทย์หรือเภสัชกรก่อนใช้":
    "* Based on traditional Thai medicine, not medical advice. Consult a doctor or pharmacist before use.",
  "🔗 เปิดหน้าของพืชนี้ (คัดลอก/แชร์ลิงก์ได้)": "🔗 Open this plant's page (link can be copied/shared)",
  "หายาก": "Rare", "ใกล้สูญพันธุ์": "Endangered", "ใกล้สูญพันธุ์อย่างยิ่ง": "Critically endangered",
  "กลุ่มยาแก้ไข้": "Fever remedies", "กลุ่มยาระบบทางเดินอาหาร": "Digestive remedies", "กลุ่มยาระบบทางเดินหายใจ": "Respiratory remedies",
  "กลุ่มยารักษาโรคผิวหนัง": "Skin remedies", "กลุ่มยาบรรเทาปวดเมื่อย": "Muscle-ache remedies", "กลุ่มยาบำรุงร่างกาย": "Tonics",
  "กลุ่มยาบำรุงโลหิต": "Blood tonics", "กลุ่มยาขับปัสสาวะ": "Diuretics", "กลุ่มยาบำรุงหัวใจ (ยาหอม)": "Heart tonics (aromatic remedies)",
  /* ---- หน้าพืช ---- */
  "วงศ์": "Family", "กลุ่มสรรพคุณ": "Medicinal group", "พันธุ์ไม้มงคล": "Auspicious tree",
  "สรรพคุณและการใช้ประโยชน์": "Medicinal uses", "ยังไม่มีรูปภาพ": "No photo yet",
  "← ดูพืชชนิดอื่น": "← See other plants", "🔗 แชร์หน้านี้": "🔗 Share this page", "✓ คัดลอกลิงก์แล้ว": "✓ Link copied",
  "ที่มา": "source",
  /* ---- ภาค / จังหวัด ---- */
  "ภาคกลาง": "Central", "ภาคเหนือ": "Northern", "ภาคใต้": "Southern", "ภาคตะวันออก": "Eastern",
  "ภาคตะวันออกเฉียงเหนือ": "Northeastern", "ภาคตะวันตก": "Western",
  "สมุทรปราการ": "Samut Prakan", "นนทบุรี": "Nonthaburi", "ปทุมธานี": "Pathum Thani", "พระนครศรีอยุธยา": "Phra Nakhon Si Ayutthaya",
  "อ่างทอง": "Ang Thong", "ลพบุรี": "Lopburi", "สิงห์บุรี": "Sing Buri", "ชัยนาท": "Chai Nat", "สระบุรี": "Saraburi",
  "นครนายก": "Nakhon Nayok", "นครสวรรค์": "Nakhon Sawan", "อุทัยธานี": "Uthai Thani", "กำแพงเพชร": "Kamphaeng Phet",
  "สุโขทัย": "Sukhothai", "พิษณุโลก": "Phitsanulok", "พิจิตร": "Phichit", "เพชรบูรณ์": "Phetchabun", "สุพรรณบุรี": "Suphan Buri",
  "นครปฐม": "Nakhon Pathom", "สมุทรสาคร": "Samut Sakhon", "สมุทรสงคราม": "Samut Songkhram", "กรุงเทพมหานคร": "Bangkok",
  "เชียงใหม่": "Chiang Mai", "เชียงราย": "Chiang Rai", "ลำปาง": "Lampang", "ลำพูน": "Lamphun", "แม่ฮ่องสอน": "Mae Hong Son",
  "น่าน": "Nan", "พะเยา": "Phayao", "แพร่": "Phrae", "อุตรดิตถ์": "Uttaradit",
  "กระบี่": "Krabi", "ชุมพร": "Chumphon", "ตรัง": "Trang", "นครศรีธรรมราช": "Nakhon Si Thammarat", "นราธิวาส": "Narathiwat",
  "ปัตตานี": "Pattani", "พังงา": "Phang Nga", "พัทลุง": "Phatthalung", "ภูเก็ต": "Phuket", "ยะลา": "Yala", "ระนอง": "Ranong",
  "สงขลา": "Songkhla", "สตูล": "Satun", "สุราษฎร์ธานี": "Surat Thani",
  "จันทบุรี": "Chanthaburi", "ฉะเชิงเทรา": "Chachoengsao", "ชลบุรี": "Chonburi", "ตราด": "Trat", "ปราจีนบุรี": "Prachinburi",
  "ระยอง": "Rayong", "สระแก้ว": "Sa Kaeo",
  "กาฬสินธุ์": "Kalasin", "ขอนแก่น": "Khon Kaen", "ชัยภูมิ": "Chaiyaphum", "นครพนม": "Nakhon Phanom", "นครราชสีมา": "Nakhon Ratchasima",
  "บึงกาฬ": "Bueng Kan", "บุรีรัมย์": "Buriram", "มหาสารคาม": "Maha Sarakham", "มุกดาหาร": "Mukdahan", "ยโสธร": "Yasothon",
  "ร้อยเอ็ด": "Roi Et", "เลย": "Loei", "ศรีสะเกษ": "Sisaket", "สกลนคร": "Sakon Nakhon", "สุรินทร์": "Surin", "หนองคาย": "Nong Khai",
  "หนองบัวลำภู": "Nong Bua Lamphu", "อำนาจเจริญ": "Amnat Charoen", "อุดรธานี": "Udon Thani", "อุบลราชธานี": "Ubon Ratchathani",
  "กาญจนบุรี": "Kanchanaburi", "ตาก": "Tak", "ประจวบคีรีขันธ์": "Prachuap Khiri Khan", "เพชรบุรี": "Phetchaburi", "ราชบุรี": "Ratchaburi",
  /* ---- กิจกรรม / ปฏิทิน ---- */
  "หมวดหมู่กิจกรรม": "Search activities", "ประเภทกิจกรรม": "Activity type", "วันที่จัดกิจกรรม": "Date",
  "ทุกเดือน": "All months", "ทุกปี": "All years",
  "สนามฟุตบอล": "Football pitch", "ตลาด": "Market", "งาน อพ.สธ.": "RSPG events", "อบรม/เวิร์คช็อป": "Training / workshops",
  "ไม่พบกิจกรรมที่ตรงกับเงื่อนไข": "No activities match your filters", "ยังไม่มีกิจกรรมในหมวดนี้": "No activities in this category yet",
  "จันทร์": "Mon", "อังคาร": "Tue", "พุธ": "Wed", "พฤหัส": "Thu", "ศุกร์": "Fri", "เสาร์": "Sat", "อาทิตย์": "Sun",
  "วันปัจจุบัน": "Today", "ตลาดนัด": "Market", "ปิดทำการ": "Closed",
  "เดือนก่อนหน้า": "Previous month", "เดือนถัดไป": "Next month", "ดูรายละเอียด →": "Details →",
  "สวนสมุนไพรปิดทำการ (ทุกวันจันทร์)": "The Herb Garden is closed (every Monday)",
  "พื้นที่ออกกำลังกายยังเปิดตามปกติ ทุกวัน 06.00–20.00 น.": "The exercise area stays open daily 6:00–20:00",
  "ตลาดในสวน": "Garden market", "ทุกเสาร์–อาทิตย์สัปดาห์แรกของเดือน": "Every Saturday–Sunday of the first week of the month",
  /* ---- แผนผังสวน ---- */
  "กลุ่มสรรพคุณสมุนไพร": "Medicinal herb groups", "อาคารและสถานที่แนะนำ": "Buildings & places",
  "ศูนย์บริการร้านค้าชุมชน": "Community shop service center", "ร้านอาหารและเครื่องดื่ม": "Food and drinks",
  "สระบัวหลวง": "Royal Lotus Pond", "ห้องประชุมสายน้ำผึ้ง": "Sai Nam Phueng meeting room",
  "จุดขึ้นรถบริการนำชมสวนสมุนไพร": "Garden tram pick-up point",
  "พันธุ์ไม้สมุนไพรเลื้อยขึ้นตามโครงสร้างทางเดิน เพิ่มบรรยากาศร่มรื่นตลอดแนวสวนด้านตะวันตก":
    "Climbing herbs cover the walkway arches, shading the western side of the garden",
  "สระน้ำขนาดใหญ่ มีเงาสะท้อนภาพของกฤษณาลงบนผิวน้ำ": "A large pond reflecting the eaglewood trees on its surface",
  "รวบรวมประวัติความเป็นมาของสมุนไพรไทยและวิถีชีวิตแบบไทย": "Exhibits on the history of Thai herbs and the Thai way of life",
  "นาฬิกาแดดบอกเวลาตามจักรราศี": "A sundial telling time by the zodiac",
  "สระบัวรูปครึ่งวงกลม เป็นสัญลักษณ์ต้อนรับผู้มาเยือน": "A semicircular lotus pond welcoming visitors",
  "ศาลาไทยสำหรับพักผ่อน": "A Thai pavilion for resting",
};

/* ข้อความที่มีส่วนเปลี่ยนได้ (ตัวเลข ชื่อจังหวัด ฯลฯ) */
const tr = s => I18N_EN[s] ?? s;
const I18N_RULES = [
  [/^(.+) \| (.+)$/, (m, a, b) => `${tr(a)} | ${tr(b)}`],
  [/^พบ (\d+) รายการ$/, (m, n) => `${n} result${n === "1" ? "" : "s"}`],
  [/^ไม้มงคลประจำจังหวัด(.+)$/, (m, p) => `Auspicious tree of ${tr(p)}`],
  [/^พันธุ์ไม้มงคลประจำจังหวัด(.+)$/, (m, p) => `Royal auspicious tree of ${tr(p)}`],
  [/^ประจำจังหวัด(.+?)(?: \((.+)\))?$/, (m, p, r) => `${tr(p)} Province` + (r ? ` (${tr(r)} region)` : "")],
  [/^พันธุ์ไม้มงคล(ภาค.+)$/, (m, r) => `Auspicious trees of the ${tr(r)} region`],
  [/^พืชใน(.+)$/, (m, g) => `More in: ${tr(g)}`],
  [/^ข้อมูลสมุนไพรประจำจังหวัดใน(.+)$/, (m, r) => `Provincial trees in the ${tr(r)} region`],
  [/^ภาพ: ([\s\S]*)$/, (m, c) => `Photo: ${c}`],
  [/^ลักษณะทั่วไป ([\s\S]+)$/, (m, d) => `Description: ${d}`],
  [/^สรรพคุณ ([\s\S]+)$/, (m, d) => `Uses: ${d}`],
  [/^ดูรายละเอียด (.+)$/, (m, n) => `View details: ${n}`],
  [/^กลุ่มที่ (\d+)$/, (m, n) => `Group ${n}`],
  [/^ขณะนี้ยังไม่มีโบรชัวร์ให้ดาวน์โหลด สอบถามข้อมูลเพิ่มเติมได้ที่ (.*)$/, (m, p) => `No brochures are available for download yet. For more information call ${p}`],
  [/^ค้นหาพืชที่ต้องการได้จากหน้าค้นหาสมุนไพร หรือสอบถามเจ้าหน้าที่ได้ที่ (.*)$/, (m, p) => `Find plants on the Herb Search page, or ask our staff at ${p}`],
  [/^ส่งข้อความบ่อยเกินไป กรุณาลองใหม่ภายหลัง(?: หรือโทร (.+))?$/, (m, p) => "Too many messages. Please try again later" + (p ? ` or call ${p}` : "")],
  [/^เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่(?: หรือโทร (.+))?$/, (m, p) => "Could not connect to the server. Please try again" + (p ? ` or call ${p}` : "")],
  [/^✗ ([\s\S]+)$/, (m, e) => `✗ ${t(e)}`],
  [/^ฐานข้อมูลพืชสมุนไพรและพันธุ์ไม้มงคลพระราชทานประจำจังหวัด รวม (\d+) ชนิด(?: \(พันธุ์ไม้มงคล (\d+) จังหวัด\))?(?: จัดเป็น (\d+) กลุ่มตามสรรพคุณรักษาโรคในตำรายาไทย)?$/,
    (m, n, p, g) => `A database of ${n} medicinal herbs and royal auspicious provincial trees` + (p ? ` (trees of ${p} provinces)` : "")
      + (g ? `, in ${g} groups by medicinal use in traditional Thai medicine` : "")],
  /* "ชื่อไทย (English Name)" → แสดงเฉพาะชื่ออังกฤษ (เช่น ชื่อกลุ่ม/สถานที่ในแผนผังสวน) */
  [/^[^()]*[฀-๿][^()]*? \(([A-Za-z][\s\S]*)\)$/, (m, en) => en],
  /* หลายรายการคั่นด้วย " · " → แปลทีละส่วน */
  [/ · /, s => s.split(" · ").map(x => t(x)).join(" · ")],
];

/* แปลข้อความ 1 ก้อน (คืนค่าเดิมถ้าไม่มีคำแปล) */
function t(s){
  if (!IS_EN || s == null) return s;
  const str = String(s), key = str.trim().replace(/\s+/g, " ");
  if (!key || !/[฀-๿]/.test(key)) return str;
  let out = I18N_EN[key];
  if (out === undefined) {
    for (const [re, fn] of I18N_RULES) {   /* fn(ข้อความทั้งก้อน, ...ส่วนที่จับได้) */
      const m = key.match(re);
      if (m) { const r = fn(key, ...m.slice(1)); if (r !== key) { out = r; break; } }
    }
  }
  if (out === undefined) return str;
  const lead = str.match(/^\s*/)[0], trail = str.match(/\s*$/)[0];   /* คงช่องว่างหน้า/หลังเดิม */
  return lead + out + trail;
}

/* แปลทุกข้อความใน element (ข้อความ + placeholder/aria-label/title/alt) */
const I18N_ATTRS = ["placeholder", "aria-label", "title", "alt"];
function i18nApply(root){
  if (!IS_EN || !root) return;
  if (root.nodeType === 3) { const v = t(root.nodeValue); if (v !== root.nodeValue) root.nodeValue = v; return; }
  if (root.nodeType !== 1 || root.closest("script,style,textarea,[data-no-i18n]")) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.parentElement && n.parentElement.closest("script,style,textarea,[data-no-i18n]")
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  for (let n; (n = w.nextNode());) {
    const p = n.parentElement;
    /* <option> ที่ไม่มี value: เก็บค่าไทยเดิมไว้ใน value ก่อน (โค้ดตัวกรองเทียบกับค่าไทย) */
    if (p.tagName === "OPTION" && !p.hasAttribute("value")) p.setAttribute("value", p.textContent);
    const v = t(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v;
  }
  [root, ...root.querySelectorAll("[placeholder],[aria-label],[title],[alt]")].forEach(el =>
    I18N_ATTRS.forEach(a => { if (el.hasAttribute && el.hasAttribute(a)) { const o = el.getAttribute(a), v = t(o); if (v !== o) el.setAttribute(a, v); } }));
}

/* ปุ่มสลับภาษา + แปลอัตโนมัติทุกครั้งที่หน้าเว็บเปลี่ยน */
function i18nInit(){
  const hdr = document.querySelector(".hdr");
  if (hdr && !document.getElementById("langBtn")) {
    const b = document.createElement("button");
    b.id = "langBtn"; b.className = "lang-btn"; b.type = "button"; b.setAttribute("data-no-i18n", "");
    b.textContent = IS_EN ? "ไทย" : "EN";
    b.setAttribute("aria-label", IS_EN ? "เปลี่ยนเป็นภาษาไทย" : "Switch to English");
    b.onclick = () => { try { localStorage.setItem("lang", IS_EN ? "th" : "en"); } catch (e) {}
      const u = new URL(location.href); u.searchParams.delete("lang"); location.replace(u.href); };
    hdr.insertBefore(b, document.getElementById("burger"));
  }
  if (IS_EN) document.body.classList.add("lang-en");
  if (!IS_EN) return;
  i18nApply(document.body);
  document.title = t(document.title);
  new MutationObserver(ms => ms.forEach(m => {
    if (m.type === "characterData") i18nApply(m.target);
    else if (m.type === "attributes") i18nApply(m.target.nodeType === 1 ? m.target : null);
    else m.addedNodes.forEach(n => i18nApply(n));
  })).observe(document.body, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:I18N_ATTRS});
}
i18nInit();   /* ไฟล์นี้โหลดท้าย <body> ก่อนสคริปต์อื่น → หน้าเว็บพร้อมแล้ว และทันแปลทุกอย่างที่วาดทีหลัง */
