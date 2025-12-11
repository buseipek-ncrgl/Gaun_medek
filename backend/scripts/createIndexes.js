import mongoose from "mongoose";
import Department from "../models/Department.js";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/mudekdb";

async function createIndexes() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log("✅ MongoDB bağlantısı kuruldu");

    // Mevcut index'leri kontrol et ve gerekirse sil
    const existingIndexes = await Department.collection.indexes();
    const nameIndex = existingIndexes.find(idx => idx.key && idx.key.name === 1);
    
    if (nameIndex && !nameIndex.unique) {
      console.log("⚠️  Mevcut 'name' index'i unique değil, siliniyor...");
      try {
        await Department.collection.dropIndex(nameIndex.name);
        console.log(`   ✅ Index '${nameIndex.name}' silindi`);
      } catch (error) {
        console.log(`   ⚠️  Index silinemedi: ${error.message}`);
      }
    }

    // Department koleksiyonunda unique index'leri oluştur
    try {
      await Department.collection.createIndex({ name: 1 }, { unique: true });
      console.log("✅ 'name' için unique index oluşturuldu");
    } catch (error) {
      if (error.code === 11000 || error.codeName === "DuplicateKey") {
        console.log("⚠️  'name' için unique index zaten mevcut veya duplikasyon var");
      } else if (error.code === 85 || error.codeName === "IndexOptionsConflict") {
        console.log("⚠️  'name' için farklı bir index zaten mevcut");
      } else {
        throw error;
      }
    }

    const codeIndex = existingIndexes.find(idx => idx.key && idx.key.code === 1);
    
    if (codeIndex && (!codeIndex.unique || !codeIndex.sparse)) {
      console.log("⚠️  Mevcut 'code' index'i unique/sparse değil, siliniyor...");
      try {
        await Department.collection.dropIndex(codeIndex.name);
        console.log(`   ✅ Index '${codeIndex.name}' silindi`);
      } catch (error) {
        console.log(`   ⚠️  Index silinemedi: ${error.message}`);
      }
    }

    try {
      await Department.collection.createIndex({ code: 1 }, { unique: true, sparse: true });
      console.log("✅ 'code' için unique sparse index oluşturuldu");
    } catch (error) {
      if (error.code === 11000 || error.codeName === "DuplicateKey") {
        console.log("⚠️  'code' için unique index zaten mevcut veya duplikasyon var");
      } else if (error.code === 85 || error.codeName === "IndexOptionsConflict") {
        console.log("⚠️  'code' için farklı bir index zaten mevcut");
      } else {
        throw error;
      }
    }

    // Mevcut index'leri listele
    const indexes = await Department.collection.indexes();
    console.log("\n📋 Mevcut index'ler:");
    indexes.forEach((idx) => {
      console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    await mongoose.disconnect();
    console.log("\n✅ İşlem tamamlandı");
  } catch (error) {
    console.error("❌ Hata:", error);
    process.exit(1);
  }
}

createIndexes();
