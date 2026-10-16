Easyway Learn Tuition Teacher App — V134 Separate Demo Login IDs

इस संस्करण में तीन अलग-अलग backend demo accounts जोड़े गए हैं। ऐप शुरू होने पर ये खाते तैयार होते हैं और demo learning data से जुड़े रहते हैं।

1) School Principal Demo
   Demo ID / Email: principal.demo@easywaylearn.invalid
   Password: Principal@123

2) Tuition Teacher Demo
   Demo ID / Email: teacher.demo@easywaylearn.invalid
   Password: Teacher@123

3) Individual Student Demo
   Demo ID / Email: student.demo@easywaylearn.invalid
   Password: Student@123

Home page पर “तीनों Demo ID और Password देखें” खोलकर credentials देख सकते हैं। संबंधित भूमिका में तुरंत प्रवेश करने के लिए demo login button भी है। Role-specific login pages पर भी वही credentials और button उपलब्ध हैं।

Teacher Demo normal teacher dashboard के existing sample data का उपयोग करता है लेकिन demo role की write restrictions बनी रहती हैं (sample test submissions allowed हैं)। Principal Demo में उसी sample teacher को school principal के अंतर्गत जोड़ा गया है ताकि “Open Teacher Dashboard” real teacher API routes से चल सके। Individual Student Demo published sample material और पहले से मौजूद sample test history दिखाता है।

पुराना Teacher Account Create flow और Take Demo के पुराने Teacher/Student Demo विकल्प बनाए रखे गए हैं।

महत्वपूर्ण: ये credentials इसी source code के backend startup seed से बनते/अपडेट होते हैं। ZIP को GitHub पर update करके Render deploy किए बिना live website पर credentials काम नहीं करेंगे। Render deployment इस ZIP से अपने-आप नहीं किया गया। ये सार्वजनिक demo accounts हैं; वास्तविक/private डेटा इनमें न डालें।
