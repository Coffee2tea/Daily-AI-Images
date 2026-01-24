# Prompt: T-Shirt Design Inspiration & Generation App

## 🎯 Project Goal
Create a complete agentic workflow application that automates T-shirt design inspiration gathering, AI analysis, image generation, and publishing workflow.

---

## 📋 Detailed Requirements

### Step 1: Etsy Popular T-Shirt Image Scraping
Create a script that:
- **Navigate to Etsy** (https://www.etsy.com)
- **Search for popular T-shirt designs/patterns** using keywords like "best seller t-shirt design", "trending t-shirt graphic"
- **Identify the top 10 most popular designs** based on popularity metrics (sales, reviews, favorites)
- **Download all 10 images** to a local folder: `./downloaded_images/`
- **Save metadata** for each image (title, shop name, price, popularity score) in a JSON file

**Technical Requirements:**
- Use browser automation (Puppeteer/Playwright) for web scraping
- Handle pagination and lazy loading
- Implement proper error handling and retry logic
- Respect rate limiting

---

### Step 2: AI Image Analysis & Idea Generation
Create an analysis module that:
- **Analyze each downloaded image** using vision AI capabilities
- **Extract design elements:**
  - Color palette
  - Typography style
  - Visual themes/motifs
  - Target audience
  - Design technique (minimalist, vintage, bold, etc.)
  - Emotional appeal

- **Generate a detailed Idea List with 10 unique ideas**, each containing:
  ```
  Idea #N:
  - Title: [Creative title]
  - Theme: [Main theme/concept]
  - Style: [Design style description]
  - Color Scheme: [Recommended colors]
  - Target Audience: [Who would buy this]
  - Design Elements: [Key visual elements to include]
  - Mood/Emotion: [What feeling it should evoke]
  - Inspiration Source: [Which Etsy image inspired this]
  - Detailed Prompt for AI Generation: [Complete prompt for image generation]
  ```

- **Send the complete Idea List via email** to: `shener1974@gmail.com`
  - Subject: "T-Shirt Design Ideas - [Date]"
  - Body: Formatted idea list with all 10 ideas
  - Include attached JSON file with structured data

**Email Configuration:**
- Use SMTP or email API service (SendGrid/Mailgun/nodemailer)
- Store credentials securely in environment variables

---

### Step 3: AI Image Generation (Parallel Process)
**Without waiting for email reply**, immediately:
- **For each idea in the Idea List**, use Gemini AI image generation tool
- **Generate 10 high-quality T-shirt design images**
- **Image specifications:**
  - Resolution: 1024x1024 or higher
  - Format: PNG with transparent background
  - Style: Print-ready T-shirt graphic
- **Save all images** to: `./generated_images/`
- **Name format:** `design_01.png`, `design_02.png`, etc.
- **Create a manifest.json** file linking each image to its corresponding idea

---

### Step 4: Email with Confirmation Page Link
Create and send a second email:
- **Recipient:** `shener1974@gmail.com`
- **Subject:** "Your T-Shirt Designs Are Ready - Confirm to Publish"
- **Body content:**
  ```
  Hi,

  Your 10 T-shirt designs have been generated successfully!

  Click the link below to preview and confirm publication:
  
  [CONFIRMATION PAGE LINK]

  This link will expire in 24 hours.

  Best regards,
  T-Shirt Design Bot
  ```

**Web Server Requirements:**
- Create a local web server (Express.js or similar)
- Host the confirmation page
- Use ngrok or similar for public URL access (or provide localhost URL for testing)

---

### Step 5: Confirmation & Gallery Pages

#### Page 1: Confirmation Page (`/confirm`)
**UI Design:**
```
┌─────────────────────────────────────────┐
│                                         │
│     🎨 T-Shirt Design Confirmation     │
│                                         │
│   10 new designs are ready for review   │
│                                         │
│      ┌─────────────────────────┐       │
│      │                         │       │
│      │   ✅ 是否确认发布？     │       │
│      │                         │       │
│      └─────────────────────────┘       │
│                                         │
│         (One large button only)         │
│                                         │
└─────────────────────────────────────────┘
```

**Functionality:**
- Clean, minimalist design
- Single prominent button: "是否确认发布？" (Confirm Publish?)
- On click: Navigate to gallery page

#### Page 2: Gallery Page (`/gallery`)
**UI Design:**
```
┌─────────────────────────────────────────┐
│        🖼️ Your T-Shirt Designs         │
├─────────────────────────────────────────┤
│  ┌───────┐  ┌───────┐  ┌───────┐       │
│  │ Img 1 │  │ Img 2 │  │ Img 3 │       │
│  │       │  │       │  │       │       │
│  └───────┘  └───────┘  └───────┘       │
│                                         │
│  ┌───────┐  ┌───────┐  ┌───────┐       │
│  │ Img 4 │  │ Img 5 │  │ Img 6 │       │
│  │       │  │       │  │       │       │
│  └───────┘  └───────┘  └───────┘       │
│                                         │
│  ┌───────┐  ┌───────┐  ┌───────┐       │
│  │ Img 7 │  │ Img 8 │  │ Img 9 │       │
│  │       │  │       │  │       │       │
│  └───────┘  └───────┘  └───────┘       │
│                                         │
│  ┌───────┐                              │
│  │ Img10 │                              │
│  │       │                              │
│  └───────┘                              │
│                                         │
│  ⬇️ Download All  |  📧 Share          │
└─────────────────────────────────────────┘
```

**Functionality:**
- Display all 10 generated images in a responsive grid
- Each image is clickable for full-size view
- Show corresponding idea title/description under each image
- Optional: Download individual or all images
- Modern, visually appealing design

---

## 🛠️ Technical Stack Suggestions

| Component | Recommended Technology |
|-----------|----------------------|
| Web Scraping | Playwright / Puppeteer |
| Backend | Node.js with Express |
| Frontend | HTML/CSS/JavaScript or React |
| Email | Nodemailer with Gmail SMTP / SendGrid |
| AI Analysis | Gemini Vision API |
| Image Generation | Gemini Image Generation API |
| Public URL | ngrok (for testing) |
| Data Storage | Local filesystem + JSON |

---

## 📁 Project Structure
```
Daily-AI-Images/
├── src/
│   ├── scraper/           # Etsy scraping module
│   ├── analyzer/          # Image analysis & idea generation
│   ├── generator/         # AI image generation
│   ├── emailer/           # Email sending service
│   └── server/            # Web server for confirmation/gallery
├── public/
│   ├── confirm.html       # Confirmation page
│   └── gallery.html       # Gallery page
├── downloaded_images/     # Etsy scraped images
├── generated_images/      # AI generated designs
├── data/
│   ├── ideas.json         # Generated ideas
│   └── manifest.json      # Image-idea mapping
├── .env                   # Environment variables (API keys, email config)
├── package.json
└── README.md
```

---

## 🔐 Environment Variables Required
```env
GEMINI_API_KEY=your_gemini_api_key
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
RECIPIENT_EMAIL=shener1974@gmail.com
```

---

## 🚀 Execution Flow
```
┌──────────────────┐
│ 1. Start Script  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 2. Scrape Etsy   │──────────────────────────┐
│    (10 images)   │                          │
└────────┬─────────┘                          │
         │                                     │
         ▼                                     │
┌──────────────────┐                          │
│ 3. Analyze &     │                          │
│    Generate Ideas│                          │
└────────┬─────────┘                          │
         │                                     │
         ├──────────────────┐                 │
         │                  │                 │
         ▼                  ▼                 │
┌──────────────────┐ ┌──────────────────┐    │
│ 4a. Send Ideas   │ │ 4b. Generate 10  │    │
│     via Email    │ │     AI Images    │    │
│                  │ │   (PARALLEL)     │    │
└──────────────────┘ └────────┬─────────┘    │
                              │               │
                              ▼               │
                    ┌──────────────────┐      │
                    │ 5. Start Server  │      │
                    │    & Send Link   │      │
                    └────────┬─────────┘      │
                              │               │
                              ▼               │
                    ┌──────────────────┐      │
                    │ 6. User Clicks   │      │
                    │    Confirm       │      │
                    └────────┬─────────┘      │
                              │               │
                              ▼               │
                    ┌──────────────────┐      │
                    │ 7. Show Gallery  │◄─────┘
                    │    with Images   │
                    └──────────────────┘
```

---

## ⚠️ Important Notes
1. **Etsy Terms of Service**: Be aware of Etsy's scraping policies. For production use, consider using their official API.
2. **Email Deliverability**: Use authenticated SMTP to avoid spam filters.
3. **Rate Limiting**: Implement delays between API calls to avoid rate limits.
4. **Error Handling**: Implement robust error handling for each step.
5. **Timeout Handling**: Set appropriate timeouts for web scraping and API calls.

---

## 🎯 Success Criteria
- [ ] Successfully download 10 images from Etsy
- [ ] Generate meaningful idea list with detailed analysis
- [ ] Email sent with idea list
- [ ] 10 unique AI-generated images created
- [ ] Confirmation email with working link sent
- [ ] Confirmation page displays single button
- [ ] Gallery page shows all 10 generated images
- [ ] Entire workflow runs automatically after initial trigger
