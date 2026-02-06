<div align="center">
<img width="70" height="85" alt="GHBanner" src="https://github.com/Cornelia-Chen/fox-ai-butler-model/blob/main/Subject%20(3).png?raw=true" />
<img width="120" height="475" alt="GHBanner" src="https://github.com/Cornelia-Chen/fox-ai-butler-model/blob/main/Subject%20(2).png?raw=true" />
<img width="70" height="275" alt="GHBanner" src="https://github.com/Cornelia-Chen/fox-ai-butler-model/blob/main/Subject.png?raw=true" />
</div>

# 🚀 Life Manager: Reimagining Home Management in 3D

> **"Turning the chaos of moving into a digital sanctuary. Life Manager isn't just an app; it's your home's digital twin."**

---

## 🌟 Inspiration & Aspiration

### From the Stress of Constant Moving to a "Digital Sanctuary"
As someone who has lived a nomadic lifestyle and moved frequently, I noticed a recurring paradox: **the more I moved, the more "stuff" I accumulated, yet the less I actually used.** After talking with friends, I realized this was a universal struggle. Whether it’s a garage filled with forgotten boxes or the sheer exhaustion of managing a home, the problem remains the same:

* **The Spatial Black Hole**: We own things but don't know *where* they are or *what* we have.
* **The "Excel Fatigue"**: Most home management apps are just glorified, tedious spreadsheets. They turn organization into a chore, leading users to lose the motivation to even open the app.

### The Birth of "Life Manager"
I wanted to build something different—a tool that bridges the gap between digital data and physical space. 

* **Virtual Home Modeling**: Using AI and Voxel art to create a high-fidelity 3D replica of your actual living space.
* **AI Butler**: Beyond simple tracking, the AI provides emotional value and proactive management, acting as a true "Butler" for your digital home.
* **Gamified Organization**: Turning the tedious task of inventory into an intuitive, visual, and rewarding game.

---

## 🔮 The Future Vision
My aspiration for **Life Manager** extends beyond personal organization:

* **Spatial Community**: I envision a social layer where friends can "visit" each other's virtual homes, sharing interior design inspirations and organizational tips.
* **AI-Driven Commerce Intelligence**: By scanning receipts, the AI Butler will facilitate seamless information exchange, alerting the community to the best discounts and helping everyone shop smarter.

---

## 🛠️ Technical Implementation

### Built With
| Category | Technology |
| :--- | :--- |
| **Frontend** | React, TypeScript, Vite |
| **AI Engine** | Google Gemini 1.5 Flash |
| **3D Rendering** | Custom Voxel Engine (CSS 3D / HTML5 Canvas) |
| **Deployment** | Vercel |

### Key Math & Logic
To ensure the 3D camera feels intuitive, I implemented a smooth transition matrix:
$$T_{final} = S \cdot T(-x_c, -y_c)$$

---

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1Rz2AchyIqP4TAxSIOl5cCQ2BA3LaD2E3

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
