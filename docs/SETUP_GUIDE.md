# Setup guide (for office staff and administrators)

You do not need to be technical to set up Deskmate. If someone in IT has already installed it, skip to step 2.

## 1. Install

Ask whoever looks after your computers or server to run one command in the Deskmate folder:

```
./install.sh
```

It prints a link that looks like `http://your-server:3000/setup?code=ABCD-1234`. Open that link in your browser. The code makes sure only you can set up this help desk.

## 2. The setup wizard

The wizard has seven short steps. You can go back at any time, and you can change everything later in **Settings**.

1. **Your organization.** Type your organization's name and choose **School**, **University or college**, **Company or nonprofit**, or **Start from scratch**. This fills in sensible departments for you.
2. **Departments.** Rename, remove, or add departments. The small box under each one lists *words that usually mean this department* (for example "password, laptop, wifi" for IT). This helps sort messages.
3. **AI assistant.** If you're not sure, keep the **Built-in assistant**. It's free, works offline, and quotes your documents. To get more natural replies, choose OpenAI or Anthropic, paste the key from their website, and press **Test connection**. A green message means it works.
4. **Channels.** The web help form is always on. Email and text messages are optional. If you turn on email, your email provider or IT team can give you the mail server details. Press **Test connection** to check them.
5. **Knowledge.** Drag in the documents people ask about most: handbooks, policies, FAQs, term dates. PDFs and text files work. Tick *Add example documents* to try things out first.
6. **Your account.** Your name, email, and a password of at least 10 characters.
7. **Finish.** Check the summary and press **Finish setup**.

## 3. Day to day

- **Inbox** shows everything waiting. *Needs your review* means the assistant wrote a draft. *Needs a person* means the message looked sensitive or the assistant couldn't answer it.
- Open a conversation to see the draft and the documents it came from. Edit it if you like, then press **Approve and send**.
- Messages about self-harm, abuse, threats, or emergencies are never answered by the assistant. Follow your usual safeguarding procedure.
- If the assistant often can't answer something, add a document about it in **Knowledge**. You can test what it would find with **Check what the assistant would find**.
- **Activity log** keeps a record of everything the assistant and your team did.

## 4. When you trust it

In **Settings → Organization**, you can let a department send confident answers automatically. It only does this when the answer comes from your documents and the message isn't sensitive. Watch *Drafts approved as written* on the home page. When it stays high, automation is probably safe for that department.

## 5. Backups

Everything lives in one place (the `deskmate-data` Docker volume, or the `data/` folder). Back it up along with your `.env` file.
