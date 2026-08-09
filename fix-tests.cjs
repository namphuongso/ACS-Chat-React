const fs = require('fs');
const path = require('path');

const replacements = {
  "'Không có cuộc hội thoại nào'": "'chat.noConversationsFound'",
  "'Chưa có tin nhắn nào'": "'chat.noMessagesFound'",
  "'Không có thành viên nào'": "'chat.noParticipants'",
  "'Đang tải...'": "'chat.loading'",
  "'Loading...'": "'chat.loading'",
  "'Search...'": "'chat.search'",
  "'You'": "'chat.you'",
  "'Remove from group'": "'chat.removeFromGroup'",
  "'Leave group'": "'chat.leaveGroup'",
  "'delivered'": "'chat.status.delivered'",
  "'sending...'": "'chat.status.sending'",
  "'failed'": "'chat.status.failed'",
  "'read'": "'chat.status.read'",
  "'Retry'": "'chat.retry'",
  "'(edited)'": "'chat.edited'",
  "'Reply'": "'chat.reply'",
  "'Forward'": "'chat.forward'",
  "'More Options'": "'chat.moreOptions'",
  "'More options'": "'chat.moreOptions'",
  "'Today'": "'chat.today'",
  "'Yesterday'": "'chat.yesterday'",
  "'Unknown User'": "'chat.unknownUser'",
  "'Remove'": "'chat.remove'",
  "'Cancel'": "'chat.cancel'",
  "'System'": "'chat.system'",
  "'Type a message...'": "'chat.typeMessage'",
  "'Send'": "'chat.send'",
  "'Send Thumbs Up'": "'chat.sendThumbsUp'"
};

function walkDir(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walkDir(file));
    } else if (file.endsWith('.test.tsx') || file.endsWith('.test.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walkDir(path.join(__dirname, 'src'));

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  
  for (const [key, value] of Object.entries(replacements)) {
    // Replace exactly the matched string in single quotes
    content = content.split(key).join(value);
    
    // Also try double quotes
    const doubleKey = key.replace(/'/g, '"');
    const doubleValue = value.replace(/'/g, '"');
    content = content.split(doubleKey).join(doubleValue);
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    console.log('Updated', file);
  }
});
