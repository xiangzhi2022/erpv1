import { NextResponse } from 'next/server';
import { generateCaptchaId } from '@/lib/auth';

// 生成随机验证码文本
function randomCaptchaText(length = 4): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去除易混淆字符 I1O0
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 生成 SVG 验证码图片
function generateCaptchaSVG(text: string): string {
  const width = 120;
  const height = 40;
  const fontSize = 28;

  // 随机颜色
  const randomColor = () =>
    `rgb(${Math.floor(Math.random() * 100 + 80)},${Math.floor(Math.random() * 100 + 80)},${Math.floor(Math.random() * 100 + 80)})`;

  // 干扰线
  let lines = '';
  for (let i = 0; i < 5; i++) {
    const x1 = Math.random() * width;
    const y1 = Math.random() * height;
    const x2 = Math.random() * width;
    const y2 = Math.random() * height;
    lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${randomColor()}" stroke-width="1" opacity="0.5"/>`;
  }

  // 干扰点
  let dots = '';
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    dots += `<circle cx="${x}" cy="${y}" r="1" fill="${randomColor()}" opacity="0.6"/>`;
  }

  // 每个字符随机旋转与偏移
  const chars = text.split('');
  const charElements = chars
    .map((char, i) => {
      const x = 15 + i * 26;
      const y = 28 + (Math.random() * 6 - 3);
      const rotate = Math.random() * 20 - 10;
      return `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${randomColor()}" transform="rotate(${rotate}, ${x}, ${y})">${char}</text>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#f0f0f0" rx="4"/>
    ${lines}
    ${dots}
    ${charElements}
  </svg>`;
}

export async function GET() {
  const code = randomCaptchaText(4);
  const captchaId = generateCaptchaId(code);
  const svg = generateCaptchaSVG(code);

  return NextResponse.json({
    captchaId,
    svg,
  });
}
