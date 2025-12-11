import mongoose from "mongoose";
import Department from "../models/Department.js";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/mudekdb";

async function cleanupDuplicates() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log("✅ MongoDB bağlantısı kuruldu");

    // Tüm bölümleri al
    const allDepartments = await Department.find().sort({ createdAt: 1 });
    console.log(`📊 Toplam ${allDepartments.length} bölüm bulundu`);

    // Name'e göre grupla
    const nameMap = new Map();
    const duplicates = [];

    allDepartments.forEach((dept) => {
      const name = dept.name.trim();
      if (!nameMap.has(name)) {
        nameMap.set(name, [dept]);
      } else {
        nameMap.get(name).push(dept);
        duplicates.push(dept);
      }
    });

    if (duplicates.length === 0) {
      console.log("✅ Duplikasyon bulunamadı. Veritabanı temiz.");
      await mongoose.disconnect();
      return;
    }

    console.log(`⚠️  ${duplicates.length} duplikasyon bulundu`);

    // Her grup için en eski kaydı tut, diğerlerini sil
    let deletedCount = 0;
    for (const [name, depts] of nameMap.entries()) {
      if (depts.length > 1) {
        // En eski kaydı tut (createdAt'e göre)
        const sorted = depts.sort((a, b) => a.createdAt - b.createdAt);
        const toKeep = sorted[0];
        const toDelete = sorted.slice(1);

        console.log(`\n📝 "${name}" için ${toDelete.length} duplikasyon siliniyor...`);
        
        for (const dept of toDelete) {
          await Department.findByIdAndDelete(dept._id);
          deletedCount++;
          console.log(`   ❌ Silindi: ${dept._id}`);
        }
        console.log(`   ✅ Korundu: ${toKeep._id} (en eski kayıt)`);
      }
    }

    console.log(`\n✅ Toplam ${deletedCount} duplikasyon temizlendi`);
    
    // Son durumu kontrol et
    const finalCount = await Department.countDocuments();
    const uniqueNames = new Set((await Department.find()).map(d => d.name));
    console.log(`\n📊 Son durum: ${finalCount} bölüm, ${uniqueNames.size} benzersiz isim`);

    await mongoose.disconnect();
    console.log("✅ İşlem tamamlandı");
  } catch (error) {
    console.error("❌ Hata:", error);
    process.exit(1);
  }
}

cleanupDuplicates();
