# Customizable Trading Dashboard

แดชบอร์ดสไตล์ trading สำหรับฝั่ง frontend ที่พัฒนาด้วย React และ TailwindCSS โดยเน้นการปรับแต่ง layout ได้จริง, interaction ที่ลื่นและเสถียร, และโครงสร้างโค้ดที่พร้อมอธิบายในเชิงสถาปัตยกรรม

โปรเจกต์นี้ไม่ได้พึ่ง fixed grid library สำหรับพฤติกรรมหลักของ dashboard แต่ใช้ layout engine แบบ custom เพื่อควบคุมการลาก, การ resize, responsive transformation และ panel state ได้ละเอียดขึ้น

รายละเอียดฝั่ง backend API ดูได้ที่ `api/README.md`

## ภาพรวม

โปรเจกต์นี้เป็น UI dashboard ที่ออกแบบมาสำหรับแสดงข้อมูลเชิง trading เช่น market trend, portfolio allocation, profit/loss และ open orders

ภายในประกอบด้วย widget ที่ลากและ resize ได้, custom layout engine, chart หลายรูปแบบด้วย ApexCharts, table แบบ custom, responsive behavior สำหรับหลายขนาดหน้าจอ, custom confirmation modal และ smooth scrolling ที่ bind กับ scroll container จริงของ dashboard

## Features

- widget ที่ลากและ resize ได้
- custom layout engine โดยไม่ใช้ fixed grid สำเร็จรูป
- ป้องกัน panel overlap ระหว่าง drag และ resize
- reset กลับสู่ default layout
- auto-arrange layout
- responsive layout สำหรับ desktop, tablet และ mobile
- chart widgets ด้วย ApexCharts
- รองรับ line, area, bar, column และ pie
- custom table ที่ resize ความกว้างคอลัมน์ได้
- expandable rows สำหรับแสดงรายละเอียดเพิ่มเติม
- pointer-based interactions สำหรับ drag, resize และ column resize
- custom confirmation modal แทน native alert/confirm
- animation ด้วย GSAP
- smooth scrolling ด้วย Lenis ที่ผูกกับ scroll container จริงของ dashboard

## Architecture

### Layout engine
ระบบ layout ของ dashboard ถูกสร้างขึ้นเองเพื่อให้ควบคุมพฤติกรรมได้ละเอียดกว่าการใช้ fixed grid library โดยรองรับ:

- การจัดตำแหน่ง panel
- collision resolution
- การ reconcile ตอน resize
- responsive layout transformation
- auto-arrange
- persistence และ restore layout

โค้ดถูกแยกเป็น module ตามหน้าที่:

- `collisionEngine.ts`
- `responsiveLayout.ts`
- `autoArrange.ts`
- `layoutPersistence.ts`

### Controller hook
logic orchestration หลักของ dashboard ถูกย้ายไปไว้ใน:

- `useDashboardLayoutController.ts`

hook นี้รับผิดชอบเรื่อง:

- drag/resize orchestration
- persistence
- responsive layout derivation
- reset/default restore
- minimized/maximized state
- animation bookkeeping

ทำให้ `DashboardGrid.tsx` เหลือหน้าที่หลักด้าน rendering และ wiring

### Chart system
ระบบ chart ใช้ presenter map แทน conditional branching กลางก้อนเดียว ทำให้เพิ่ม variant ได้ง่ายขึ้น โดยโครงสร้างหลักมี:

- stable chart identity จาก widget id
- view-model สำหรับ normalize ข้อมูล chart
- variant-specific presentation
- shared option builder สำหรับ ApexCharts

### Table system
table ถูกเขียนแบบ custom เพื่อให้เหมาะกับ dashboard นี้โดยตรง รองรับ:

- pointer-based column resize
- expandable rows
- persistence ของ column width
- keyboard-accessible row expansion
- nested scroll ภายใน widget

## Interaction Model

โปรเจกต์นี้เลือกใช้ Pointer Events แทน mouse events แบบเดิมสำหรับ interaction หลัก

เหตุผล:

- รองรับ mouse, touch และ pen ใน model เดียว
- เหมาะกับ dashboard ที่ต้องใช้งานบน tablet หรืออุปกรณ์ touch
- ลดการแยก logic ระหว่าง mouse กับ touch
- ทำให้ responsive requirement ดูน่าเชื่อถือมากขึ้น

Pointer Events ถูกใช้กับ:

- widget drag
- widget resize
- table column resize

## Testing Strategy

แนวทางการทดสอบเน้นความเสถียรของ interaction และความถูกต้องของ layout behavior

ครอบคลุมเรื่องหลัก ๆ เช่น:

- layout engine logic
- responsive transformation
- collision resolution
- resize stability
- auto-arrange behavior
- modal interactions
- pointer hook behavior
- integration test ของ dashboard drag/resize
- interaction test ของ table column resize
- utility test สำหรับ `getDateRange`

เป้าหมายคือเพิ่ม confidence ใน behavior จริง ไม่ใช่ไล่ coverage แบบไม่มีน้ำหนัก

## Tradeoffs

### Custom layout engine vs library
การเขียน layout engine เองช่วยให้ควบคุมพฤติกรรม drag, resize, responsive transformation และ panel state ได้ตรงตามโจทย์มากกว่าใช้ library สำเร็จรูป แต่แลกมาด้วย complexity และ maintenance cost ที่สูงขึ้นในระยะยาว

### ความซับซ้อนของ `chartOptions`
ความยืดหยุ่นของ chart ถูกรวมศูนย์ไว้ที่ `chartOptions.ts` ทำให้ควบคุม visual behavior ได้สม่ำเสมอ แต่ไฟล์นี้มี conditional complexity สูงกว่าส่วนอื่น หากระบบ chart โตขึ้นควรแยกตาม chart family หรือ variant

### Table ที่ยังไม่มี virtualization
table ถูกออกแบบให้ชัดและเหมาะกับ scope ของ assignment ก่อน จึงยังไม่ได้ทำ virtualization สำหรับข้อมูลจำนวนมาก หาก scale ของข้อมูลโตขึ้นมาก จุดนี้จะเป็น candidate แรกสำหรับการ optimize

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### ติดตั้ง dependencies

```bash
npm install
```

### รันโปรเจกต์

```bash
cd web
npm run dev
```

### รัน tests

```bash
cd web
npm test
```

### build production

```bash
cd web
npm run build
```
