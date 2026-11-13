// Create a clean 16x16 / 32x32 transparent PNG icon for Electron Tray & Window
const fs = require('fs');
const path = require('path');

// 1x1 transparent PNG / simple valid PNG base64 fallback
// 64x64 Gold KS icon encoded
const iconBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAADwElEQVR4nO2aTWsTURDHf/vYNNpqa0s/iqcWURDBi/biSRREBPEivfgFvPnF3v0Q8Wb1oHjxVvGg1It48aKCoAcRQWk1sdlsNuNhtptmmzTZJtlqDswPdt7ezL/z25mdnflPAUEQhI1j9Vowm0vL5y43z29E63W0vIHW72n9ntbvaf2e1u9p/Z7W72n9ntbvaf2e1u9p/Z7W72n9ntbvaf2e1u9p/Z7/A9bK5tLyebS/eX4j/g9Yq/9vAAVBEARBEARBsDEkYAU4AW4B54FDQG2Vdgk4B5wFmoC9wH5gD/D35wlwDfgO/AIGwBhYALrAHFAHzgFngeqy7RFgD/A35AlwGfgI9IHZ1X/7q/2TjZt7q/8b3gK/gDfgKfAQeAx03fCj/eP1/3HgI9AD5oF5oA30gcXA1f1XgU17wE7gFvAMeA18Anrv/9h6EHgBPAc63t+0B1wE3gKvF6G1HjgDPAF+7gHrgGvAR+BtqG3jVd71f7kHlIDzwAvgbah9CzwCHq/x/03AReAt8C5U/q/wDPi9B9wBvgPfgI8h+n+7B1wG3gLvQ+Tf7gG1Vf6/A7wP1f+7e8Ai8AZ4D3wJ1X/LPWAdcA14D7wP0f/bPWAVeA+8D7X/b/eAc8Ab4F2o/b92D/gG/AjV/z17QAP4BvwO1f+7e8Bl4D3wPlT/7+4B64BrwHvgbaj9v3YPqP3L/78GfgTqv1X+r7QH/AJq7f9f7wEvgPeh+n93D7gMvAfeh+j/7R5wFXgPvA+1/2/3gE3gPfA+VP9v7wFtwA/gfaj+394DfgS0/1f3gB/Aj1D7f/P/2QPeAB9C7f+1e8AV4CPwPlT/7+4BdeA98C5U/+3y7wO7gA/AZ6CPfP/7wDngE3AWmAO2AZeAHmBv/p9bQAP4BDQCvP8JcA24DvwEesB4gPs7D7wBbgA1N/w5oB/g/l4BH4F3QM8Nf471e98A1/r/KjAGPgNfge8b/H/l/4N3gL+B7kY/wD1n9Vowm0vL5y43z29E63W0vIHW72n9ntbvaf2e1u9p/Z7W72n9ntbvaf2e1u9p/Z7W72n9ntbvaf2e1u9p/Z7/A9bK5tLyebS/eX4j/g9Yq/9vAAVBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEIT/Ef8B8R/7101l0q0AAAAASUVORK5CYII=';

const assetsDir = path.join(__dirname, '..', 'tally-desktop-app', 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

fs.writeFileSync(path.join(assetsDir, 'icon.png'), Buffer.from(iconBase64, 'base64'));
fs.writeFileSync(path.join(assetsDir, 'tray.png'), Buffer.from(iconBase64, 'base64'));

console.log('✅ Generated app & tray icons.');
