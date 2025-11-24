# Deployment Guide - SellOnLLM

## 🚀 Deploy to Vercel (Recommended)

Your project is ready to deploy! Vercel will host both your **frontend** (HTML/CSS/JS) and **backend** (API) in one place.

---

## ✅ What You Have

```
sellonllm/
├── api/
│   └── audit.js          ← Backend API (serverless function)
├── css/
│   ├── style.css
│   └── llm-audit-styles.css
├── js/
│   ├── script.js
│   └── llm-audit.js      ← Calls /api/audit
├── index.html            ← Frontend
├── privacy-policy.html
├── vercel.json           ← Vercel configuration
└── package.json          ← Project metadata
```

**Everything is configured!** ✨

---

## 📋 Prerequisites

1. **GitHub Account** (free) - [github.com](https://github.com)
2. **Vercel Account** (free) - [vercel.com](https://vercel.com)
3. **Domain** (you have sellonllm.com)

---

## 🎯 Deployment Steps

### **Step 1: Install Vercel CLI** (Optional, but recommended for testing)

```bash
npm install -g vercel
```

### **Step 2: Test Locally** (Optional)

```bash
cd /Users/vipulagarwal/Documents/sellonllm
vercel dev
```

This will:
- Start local server at `http://localhost:3000`
- Your API will be at `http://localhost:3000/api/audit`
- Test the audit tool locally before deploying

**Try it:**
1. Open `http://localhost:3000`
2. Enter a website URL
3. Click "Analyze My Site"
4. See real results! 🎉

### **Step 3: Push to GitHub**

```bash
cd /Users/vipulagarwal/Documents/sellonllm

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - SellOnLLM landing page with audit tool"

# Create GitHub repo and push
# (Follow GitHub instructions to create new repo)
git remote add origin https://github.com/YOUR_USERNAME/sellonllm.git
git branch -M main
git push -u origin main
```

### **Step 4: Deploy to Vercel**

**Option A: Via Vercel Dashboard (Easiest)**

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click "Import Git Repository"
3. Select your `sellonllm` repo
4. Vercel auto-detects settings ✅
5. Click **"Deploy"**
6. Done! 🎉

**Option B: Via CLI**

```bash
cd /Users/vipulagarwal/Documents/sellonllm
vercel --prod
```

Follow prompts:
- Link to existing project? **No**
- Project name? **sellonllm**
- Directory? **.**
- Want to override settings? **No**

### **Step 5: Add Your Custom Domain**

In Vercel Dashboard:

1. Go to your project → **Settings** → **Domains**
2. Add domain: `sellonllm.com`
3. Add domain: `www.sellonllm.com`
4. Vercel gives you DNS records

**At your domain registrar** (GoDaddy, Namecheap, etc.):

Add these DNS records:
```
A Record:
  Name: @
  Value: 76.76.21.21 (Vercel IP)

CNAME Record:
  Name: www
  Value: cname.vercel-dns.com
```

**Wait 5-60 minutes** for DNS to propagate.

---

## 🔍 How It Works After Deployment

### **Frontend (Static Files)**
- `https://sellonllm.com/` → Your landing page
- `https://sellonllm.com/privacy-policy.html` → Privacy policy
- All CSS, JS files served from CDN

### **Backend API (Serverless)**
- `https://sellonllm.com/api/audit` → Your audit API

**User Flow:**
1. User visits `sellonllm.com`
2. User enters website URL
3. Frontend JavaScript calls `POST /api/audit`
4. Vercel serverless function runs:
   - Checks LLM.txt
   - Checks robots.txt
   - Checks sitemap
   - Checks meta tags
   - Checks SSL
   - Checks mobile-friendly
5. Returns results to frontend
6. Frontend displays beautiful results ✨

---

## 💰 Vercel Pricing

**Hobby Plan (FREE):**
- ✅ 100 GB bandwidth/month
- ✅ Unlimited API calls
- ✅ Custom domain
- ✅ SSL certificate
- ✅ 100 serverless function executions/day
- ✅ 10 second function timeout

**This is perfect for your use case!**

With 100 free audits/day, that's **3,000 audits/month** for free.

**Pro Plan ($20/month):**
- 1TB bandwidth
- Unlimited serverless executions
- 60 second timeout
- Team collaboration

---

## 🧪 Testing Your Deployment

### **1. Test Frontend**
Visit: `https://sellonllm.com`

Should see:
- ✅ Landing page loads
- ✅ Audit form visible
- ✅ All styles work
- ✅ Mobile responsive

### **2. Test API Directly**

```bash
curl -X POST https://sellonllm.com/api/audit \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

Should return:
```json
{
  "checks": {
    "llm_txt_exists": false,
    "robots_txt_proper": true,
    ...
  },
  "details": {
    ...
  }
}
```

### **3. Test Audit Tool**

1. Visit `https://sellonllm.com`
2. Enter URL: `https://shopify.com`
3. Click "Analyze My Site"
4. Should see:
   - Loading animation
   - Results page
   - 8 checks with pass/fail
   - Overall score

### **4. Test Email Capture**

1. See results page
2. Scroll to "Want Deeper Analysis?"
3. Enter email in GetWaitlist widget
4. Check GetWaitlist dashboard for new signup

---

## 📊 Monitoring

### **Vercel Dashboard**

Monitor:
- Page views
- API calls
- Function execution time
- Errors
- Bandwidth usage

**Path:** Vercel Dashboard → Your Project → Analytics

### **Google Analytics**

Track:
- Audits started
- Audits completed
- Email signups
- Conversion rate

### **GetWaitlist**

Track:
- Email signups
- Lead quality
- Growth rate

---

## 🐛 Troubleshooting

### **Issue: API Returns 404**

**Fix:**
- Ensure `api/audit.js` exists
- Redeploy: `vercel --prod`

### **Issue: CORS Error**

**Fix:**
Already handled in `vercel.json` and `api/audit.js`

If still issues, check browser console.

### **Issue: Timeout Error**

**Fix:**
- Vercel free plan has 10s timeout
- Most checks complete in 2-5 seconds
- If needed, upgrade to Pro ($20/month) for 60s timeout

### **Issue: Demo Data Still Showing**

**Fix:**
Check browser console. If API fails, it falls back to demo.

Verify API works:
```bash
curl -X POST https://sellonllm.com/api/audit \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

### **Issue: Slow Performance**

**Cause:**
- Fetching multiple URLs (robots.txt, sitemap, homepage)
- Each fetch can take 1-3 seconds

**Solutions:**
1. Add caching (Redis/Upstash)
2. Run checks in parallel (already done)
3. Upgrade to Pro plan for better performance

---

## 🚀 Performance Optimization

### **Add Caching** (Recommended)

Cache results for 1 hour to avoid re-checking same sites:

1. Sign up for [Upstash](https://upstash.com) (free Redis)
2. Add environment variables in Vercel:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

3. Update `api/audit.js`:

```javascript
// At the top
const redis = require('@upstash/redis');

// In handler function
const cacheKey = `audit:${url}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return res.json(cached);
}

// ... perform checks ...

// Cache for 1 hour
await redis.set(cacheKey, result, { ex: 3600 });
```

### **Rate Limiting**

Prevent abuse by limiting requests per IP:

```bash
npm install @vercel/edge
```

Update `api/audit.js` to use Vercel Edge Middleware.

---

## 📈 Scaling

### **Free Tier Limits**

- 100 GB bandwidth/month
- 100 serverless executions/day
- ~3,000 audits/month

**When you hit limits:**

### **Option 1: Upgrade Vercel Pro ($20/month)**
- 1 TB bandwidth
- Unlimited executions
- Better performance

### **Option 2: Add Caching**
- Reduces API calls by 80%
- Same site audited once per hour
- Can handle 10x more traffic

### **Option 3: Require Email First**
- Gate audit behind email signup
- Reduces abuse
- Higher quality leads

---

## 🔐 Security Best Practices

### **Already Implemented:**
✅ URL validation
✅ HTTPS only
✅ CORS configured
✅ Timeout limits (10s)

### **Add Rate Limiting:**

Create `api/_middleware.js`:

```javascript
import { ipAddress } from '@vercel/edge';

export const config = {
  matcher: '/api/:path*',
};

const requests = new Map();

export default function middleware(req) {
  const ip = ipAddress(req) || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const maxRequests = 10;

  // Clean old entries
  for (const [key, timestamp] of requests.entries()) {
    if (now - timestamp > windowMs) {
      requests.delete(key);
    }
  }

  // Count requests from this IP
  const userRequests = Array.from(requests.entries())
    .filter(([k]) => k.startsWith(ip))
    .length;

  if (userRequests >= maxRequests) {
    return new Response('Too many requests', { status: 429 });
  }

  requests.set(`${ip}:${now}`, now);
}
```

---

## 🎉 You're Ready to Launch!

### **Checklist:**

- [x] Frontend built
- [x] Backend API created
- [x] Vercel config ready
- [ ] Deploy to Vercel
- [ ] Add custom domain
- [ ] Test audit tool
- [ ] Monitor analytics
- [ ] Collect emails
- [ ] Grow! 🚀

---

## 🆘 Need Help?

**Vercel Docs:** https://vercel.com/docs
**Vercel Support:** support@vercel.com
**Community:** https://github.com/vercel/vercel/discussions

---

**Your site will be live at `https://sellonllm.com` in under 5 minutes!** 🎊

