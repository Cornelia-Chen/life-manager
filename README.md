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
As someone who has lived a nomadic lifestyle and moved frequently, I noticed a recurring paradox: **the more I moved, the more "stuff" I accumulated, yet the less I actually used.** 
* **The Spatial Black Hole**: We own things but don't know **where** they are or **what** we have (e.g., a garage filled with forgotten boxes).
* **The "Excel Fatigue"**: Traditional apps are just glorified, tedious spreadsheets. They turn organization into a chore, leading users to lose the motivation to even open the app.

**Life Manager** was born to bridge the gap between digital data and physical space, turning the tedious task of inventory into an intuitive, visual, and rewarding game.

---
### The Birth of "Life Manager"
I wanted to build something different—a tool that bridges the gap between digital data and physical space. 

* **Virtual Home Modeling**: Using AI and Voxel art to create a high-fidelity 3D replica of your actual living space.
  <img width="300" height="475" alt="GHBanner" src="https://github.com/Cornelia-Chen/fox-ai-butler-model/blob/main/Screenshot%202026-02-04%20104107.png?raw=true" />
  <img width="300" height="475" alt="GHBanner" src="https://github.com/Cornelia-Chen/fox-ai-butler-model/blob/main/remindstoredplace.png?raw=true" />
  <img width="300" height="475" alt="GHBanner" src="https://github.com/Cornelia-Chen/fox-ai-butler-model/blob/main/screenreceipt.png?raw=true" />
* **AI Butler**: Beyond simple tracking, the AI provides emotional value and proactive management, acting as a true "Butler" for your digital home.
* **Gamified Organization**: Turning the tedious task of inventory into an intuitive, visual, and rewarding game.

---

## 🔮 The Future Vision
My aspiration for **Life Manager** extends beyond personal organization:

-  **Spatial Community**: Visit friends' virtual homes for design inspiration and social interaction.
-  **Smart Commerce**: AI receipt scanning to automatically find the best local discounts for the community.
-  **High-Fidelity Furniture Rendering** : Improve furniture visual quality to more closely match real-world shapes, proportions, and materials, while maintaining performance efficiency in the browser.

-  **Realistic-to-Stylized Apparel Projection**  
  Support clothing visualization that can:
    - Accurately resemble real garments based on photos or descriptions  
     - Or be *diffracted* into a **cartoon-style** representation, balancing recognizability with visual clarity

---


## 🛠️ Technical Implementation

### Built With
| Category | Technology |
| :--- | :--- |
| **Frontend** | React, TypeScript, Vite |
| **AI Engine** | Google Gemini 3 Flash |
| **3D Rendering** | Custom Voxel Engine (CSS 3D / HTML5 Canvas) |
| **Deployment** | Vercel |

### Key Math & Logic
To ensure the 3D camera feels intuitive, I implemented a smooth transition matrix:
$$T_{final} = S \cdot T(-x_c, -y_c)$$

---

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1Rz2AchyIqP4TAxSIOl5cCQ2BA3LaD2E3

## **Try it out**: 
https://life-manager-mocha.vercel.app/

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
