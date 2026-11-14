const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  config: {
    name: "sing",
    aliases: ["song", "music", "أغنية", "صوت"],
    version: "2.0.0",
    author: "سينكو",
    countDown: 5,
    role: 0,
    description: "البحث وتحميل الأغاني من يوتيوب بنظام القوائم",
    category: "الوسائط",
    guide: "{pn} <اسم الأغنية>"
  },

  onStart: async function ({ api, args, event }) {
    const { threadID, messageID, senderID } = event;
    const query = args.join(" ").trim();
    
    if (!query) {
      let errMsg = ``;
      errMsg += `╮────∙⋆⋅「 تنبيه 」⋅⋆∙────╭\n`;
      errMsg += `│\n`;
      errMsg += `│  ⚠️ يـرجـى كـتـابـة اسـم الـأغـنـيـة\n`;
      errMsg += `│  ◈ الاستخدام : sing [اسم الأغنية]\n`;
      errMsg += `│\n`;
      errMsg += `╯───────∙⋆⋅ ※ ⋅⋆∙───────╰`;
      return api.sendMessage(errMsg, threadID, messageID);
    }

    api.setMessageReaction("⌛", messageID, () => {}, true);

    try {
      // جلب قائمة النتائج (نفترض أن الـ API يدعم البحث أو يرجع مصفوفة، إذا كان الـ API القديم يعيد نتيجة واحدة، سنقوم بالبحث بروابط أو قائمة بديلة، سأجهز لك هيكل الرد المتعدد)
      const apiUrl = `https://azadx69x-all-apis-top.vercel.app/api/sing?song=${encodeURIComponent(query)}`;
      const res = await axios.get(apiUrl, { timeout: 30000 });

      if (!res.data?.success) {
        api.setMessageReaction("❌", messageID, () => {}, true);
        let notFoundMsg = ``;
        notFoundMsg += `╮────∙⋆⋅「 خطأ 」⋅⋆∙────╭\n`;
        notFoundMsg += `│\n`;
        notFoundMsg += `│  ❌ لـم يـتـم الـعـثـور عـلـى نـتـائـج\n`;
        notFoundMsg += `│\n`;
        notFoundMsg += `╯───────∙⋆⋅ ※ ⋅⋆∙───────╰`;
        return api.sendMessage(notFoundMsg, threadID, messageID);
      }

      // معالجة البيانات سواء كانت مصفوفة أو نتيجة واحدة لتحويلها لنظام قوائم
      const rawData = res.data.results || res.data.list || [res.data];
      const results = rawData.map(item => ({
        title: item.info?.title || item.title || "بدون عنوان",
        artist: item.info?.artist || item.artist || "غير معروف",
        url: item.audio?.url || item.url
      })).filter(x => x.url);

      if (results.length === 0) {
        return api.sendMessage("❌ لم يتم العثور على روابط صالحة للتحميل.", threadID, messageID);
      }

      await sendSongPage(api, event, results, 1, query);

    } catch (err) {
      api.setMessageReaction("❌", messageID, () => {}, true);
      let serverErr = ``;
      serverErr += `╮────∙⋆⋅「 خطأ في السيرفر 」⋅⋆∙────╭\n`;
      serverErr += `│\n`;
      serverErr += `│  ❌ حـدث خـطأ أثـنـاء جـلـب الـنـتـائـج\n`;
      serverErr += `│\n`;
      serverErr += `╯───────∙⋆⋅ ※ ⋅⋆∙───────╰`;
      api.sendMessage(serverErr, threadID, messageID);
    }
  },

  onReply: async function ({ api, event, handleReply }) {
    const { threadID, messageID, body, senderID } = event;
    
    if (handleReply.author && senderID !== handleReply.author) return;
    if (handleReply.name !== "sing") return;

    const input = body.trim().toLowerCase();

    if (input === "التالي" || input === "next") {
      const nextPage = handleReply.page + 1;
      const maxPage = Math.ceil(handleReply.results.length / 10);
      
      if (nextPage > maxPage) {
        let maxPageMsg = ``;
        maxPageMsg += `╮────∙⋆⋅「 تنبيه 」⋅⋆∙────╭\n`;
        maxPageMsg += `│\n`;
        maxPageMsg += `│  🔚 لا تـوجـد صـفـحـات أخـرى\n`;
        maxPageMsg += `│\n`;
        maxPageMsg += `╯───────∙⋆⋅ ※ ⋅⋆∙───────╰`;
        return api.sendMessage(maxPageMsg, threadID, messageID);
      }
      
      try { api.unsendMessage(handleReply.messageID); } catch(e) {}
      return sendSongPage(api, event, handleReply.results, nextPage, handleReply.query);
    }

    const choice = parseInt(input);
    if (isNaN(choice) || choice < 1 || choice > 10) return;

    const index = (handleReply.page - 1) * 10 + (choice - 1);
    const selected = handleReply.results[index];
    if (!selected) return;

    try { api.unsendMessage(handleReply.messageID); } catch(e) {}
    api.setMessageReaction("📥", messageID, () => {}, true);

    const cacheDir = path.join(__dirname, "cache");
    fs.ensureDirSync(cacheDir);

    const filePath = path.join(cacheDir, `song_${senderID}_${Date.now()}.m4a`);
    
    try {
      const downloadRes = await axios({
        url: selected.url,
        method: "GET",
        responseType: "arraybuffer",
        timeout: 60000,
        headers: { "User-Agent": "Mozilla/5.0" }
      });

      fs.writeFileSync(filePath, Buffer.from(downloadRes.data));

      let successMsg = ``;
      successMsg += `╮───────∙⋆⋅ ※ ⋅⋆∙───────╭\n`; 
      successMsg += `    تـــحـــمـــيــــل الـــصـــوت\n`; 
      successMsg += `╯───────∙⋆⋅ ※ ⋅⋆∙───────╰\n\n`; 
      successMsg += `╮────∙⋆⋅「 معلومات الأغنية 」\n`;
      successMsg += `│ › العنوان : ${selected.title.slice(0, 35)}...\n`;
      successMsg += `│ › الفنان : ${selected.artist}\n`;
      successMsg += `│ › الحالة : تم التحميل بنجاح ✅\n`;
      successMsg += `╯───────∙⋆⋅ ※ ⋅⋆∙───────◈`;

      await api.sendMessage(
        {
          body: successMsg,
          attachment: fs.createReadStream(filePath)
        },
        threadID,
        () => { 
          try { fs.unlinkSync(filePath); } catch (e) {}
          api.setMessageReaction("✅", messageID, () => {}, true);
        },
        messageID
      );

    } catch (err) {
      api.sendMessage("❌ فشل تحميل ملف الصوت.", threadID, messageID);
    }
  }
};

async function sendSongPage(api, event, allResults, page, query) {
  const { threadID, messageID, senderID } = event;
  const start = (page - 1) * 10;
  const pageResults = allResults.slice(start, start + 10);

  let msg = ``;
  msg += `╮───────∙⋆⋅ ※ ⋅⋆∙───────╭\n`; 
  msg += `    نــتــائــج بــحــث الــأغــانــي\n`; 
  msg += `╯───────∙⋆⋅ ※ ⋅⋆∙───────╰\n\n`; 

  msg += `╮────∙⋆⋅「 معلومات البحث 」\n`;
  msg += `│ › البحث : ${query}\n`;
  msg += `│ › الصفحة : ${page} من ${Math.ceil(allResults.length / 10)}\n`;
  msg += `╯───────∙⋆⋅ ※ ⋅⋆∙───────◈\n\n`;

  msg += `╮────∙⋆⋅「 قائمة الأغاني 」\n`;
  pageResults.forEach((v, i) => {
    const num = (i + 1).toString().padStart(2, '0');
    const title = v.title ? v.title.slice(0, 28) + "..." : "أغنية";
    msg += `│ › [ ${num} ] ⟜ ${title} (${v.artist})\n`;
  });
  msg += `╯───────∙⋆⋅ ※ ⋅⋆∙───────◈\n\n`;

  msg += `╮───────∙⋆⋅ ※ ⋅⋆∙───────◈\n`;
  msg += `│ 💡 رد برقم الأغنية للتحميل المباشر\n`;
  msg += `│ ➡️ أرسل "التالي" لعرض المزيد\n`;
  msg += `╯───────∙⋆⋅ ※ ⋅⋆∙───────◈`;

  return api.sendMessage(msg, threadID, (err, info) => {
    if (!err) {
      if (!global.client.handleReply) global.client.handleReply = [];
      global.client.handleReply.push({
        name: "sing",
        messageID: info.messageID,
        author: senderID,
        results: allResults,
        query,
        page
      });
    }
  }, messageID);
}
