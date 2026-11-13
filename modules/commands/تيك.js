const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  config: {
    name: "تيك",
    version: "1.0.9",
    author: "سينكو",
    countDown: 5,
    prefix: false,
    category: "الوسائط"
  },

  onStart: async function ({ api, event, args }) {
    const { threadID, messageID, senderID } = event;
    const query = args.join(" ").trim();
    
    if (!query) {
      let errMsg = ``;
      errMsg += `╮────∙⋆⋅「 تنبيه 」⋅⋆∙────╭\n`;
      errMsg += `│\n`;
      errMsg += `│  ⚠️ يـرجـى كـتـابـة كـلـمـة بـحـث\n`;
      errMsg += `│  ◈ الاستخدام : تيك [البحث]\n`;
      errMsg += `│\n`;
      errMsg += `╯───────∙⋆⋅ ※ ⋅⋆∙───────╰`;
      return api.sendMessage(errMsg, threadID, messageID);
    }

    api.setMessageReaction("⌛", messageID, () => {}, true);

    try {
      const res = await axios.get(`https://azadx69x-tiktok-api.vercel.app/tiktok/search?query=${encodeURIComponent(query)}`);
      const data = res.data.list || [];
      
      if (data.length === 0) {
        let notFoundMsg = ``;
        notFoundMsg += `╮────∙⋆⋅「 خطأ 」⋅⋆∙────╭\n`;
        notFoundMsg += `│\n`;
        notFoundMsg += `│  ❌ لـم يـتـم الـعـثـور عـلـى نـتـائـج\n`;
        notFoundMsg += `│  ◈ للبحث : ${query}\n`;
        notFoundMsg += `│\n`;
        notFoundMsg += `╯───────∙⋆⋅ ※ ⋅⋆∙───────╰`;
        return api.sendMessage(notFoundMsg, threadID, messageID);
      }

      await sendPage(api, event, data, 1, query);

    } catch (err) {
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
    
    // التحقق من أن المستخدم الحالي هو صاحب طلب البحث الأساسي
    if (handleReply.author && senderID !== handleReply.author) return;

    // التأكد من أن الرد موجه لملف التيكتوك هذا
    if (handleReply.name !== "تيك") return;

    const input = body.trim().toLowerCase();

    // التنقل بين الصفحات
    if (input === "التالي" || input === "next") {
      const nextPage = handleReply.page + 1;
      const maxPage = Math.ceil(handleReply.results.length / 12);
      
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
      return sendPage(api, event, handleReply.results, nextPage, handleReply.query);
    }

    const choice = parseInt(input);
    if (isNaN(choice) || choice < 1 || choice > 12) return;

    const index = (handleReply.page - 1) * 12 + (choice - 1);
    const selected = handleReply.results[index];
    if (!selected) return;

    try { api.unsendMessage(handleReply.messageID); } catch(e) {}
    api.setMessageReaction("📥", messageID, () => {}, true);

    const cacheDir = path.join(__dirname, "cache");
    fs.ensureDirSync(cacheDir);

    const filePath = path.join(cacheDir, `tt_${senderID}_${Date.now()}.mp4`);
    
    try {
      const videoUrl = selected.noWatermark || selected.play || selected.video;
      const videoRes = await axios.get(videoUrl, { responseType: "stream" });
      const writer = fs.createWriteStream(filePath);
      videoRes.data.pipe(writer);

      writer.on('finish', () => {
        let successMsg = ``;
        successMsg += `╮────∙⋆⋅「 تحميل ناجح 」⋅⋆∙────╭\n`;
        successMsg += `│\n`;
        successMsg += `│  ◈ العـنـوان : ${selected.title ? selected.title.slice(0, 45) + "..." : "بدون عنوان"}\n`;
        successMsg += `│  ◈ الـحـالـة : تم القنص بنجاح ✅\n`;
        successMsg += `│\n`;
        successMsg += `╯───────∙⋆⋅ ※ ⋅⋆∙───────╰`;

        api.sendMessage({
          body: successMsg,
          attachment: fs.createReadStream(filePath)
        }, threadID, () => {
          try { fs.unlinkSync(filePath); } catch (e) {}
        }, messageID);
      });

      writer.on('error', () => {
        api.sendMessage("❌ خطأ أثناء كتابة ملف الفيديو.", threadID, messageID);
      });

    } catch (err) {
      api.sendMessage("❌ فشل تحميل الفيديو من الرابط.", threadID, messageID);
    }
  }
};

async function sendPage(api, event, allResults, page, query) {
  const { threadID, messageID, senderID } = event;
  const start = (page - 1) * 12;
  const pageResults = allResults.slice(start, start + 12);

  let msg = ``;
  msg += `╮───────∙⋆⋅ ※ ⋅⋆∙───────╭\n`; 
  msg += `    نــتــائــج بــحــث تــيــك تــوك\n`; 
  msg += `╯───────∙⋆⋅ ※ ⋅⋆∙───────╰\n\n`; 

  msg += `╮────∙⋆⋅「 معلومات البحث 」\n`;
  msg += `│ › الكلمة : ${query}\n`;
  msg += `│ › الصفحة : ${page} من ${Math.ceil(allResults.length / 12)}\n`;
  msg += `╯───────∙⋆⋅ ※ ⋅⋆∙───────◈\n\n`;

  msg += `╮────∙⋆⋅「 قائمة الفيديوهات 」\n`;
  pageResults.forEach((v, i) => {
    const num = (i + 1).toString().padStart(2, '0');
    const title = v.title ? v.title.slice(0, 30) + "..." : "فيديو تيك توك";
    msg += `│ › [ ${num} ] ⟜ ${title}\n`;
  });
  msg += `╯───────∙⋆⋅ ※ ⋅⋆∙───────◈\n\n`;

  msg += `╮───────∙⋆⋅ ※ ⋅⋆∙───────◈\n`;
  msg += `│ 💡 رد برقم الفيديو للتحميل المباشر\n`;
  msg += `│ ➡️ أرسل "التالي" لعرض المزيد\n`;
  msg += `╯───────∙⋆⋅ ※ ⋅⋆∙───────◈`;

  return api.sendMessage(msg, threadID, (err, info) => {
    if (!err) {
      if (!global.client.handleReply) global.client.handleReply = [];
      global.client.handleReply.push({
        name: "تيك",
        messageID: info.messageID,
        author: senderID,
        results: allResults,
        query,
        page
      });
    }
  }, messageID);
}
