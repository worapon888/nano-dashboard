# Customizable Trading Dashboard

A frontend trading-style dashboard built with React and TailwindCSS, designed around customizable layout control, interactive widgets, and responsive behavior.

This project focuses on interaction quality and maintainable frontend architecture rather than relying on a fixed grid library for dashboard behavior.

Backend API documentation is available in `api/README.md`.

## English

### Overview
This project is a customizable dashboard UI for monitoring trading-related data such as market trends, portfolio distribution, profit/loss summaries, and open orders.

It includes draggable and resizable widgets, a custom layout engine, responsive behavior across desktop/tablet/mobile, chart visualization with ApexCharts, a custom interactive table, and polished UX details such as animated modal transitions and smooth scrolling.

### Features
- Draggable and resizable dashboard widgets
- Custom layout engine without a fixed grid dependency
- Collision-safe layout updates during drag and resize
- Reset to default layout
- Auto-arrange support
- Responsive layout behavior for desktop, tablet, and mobile
- Chart widgets using ApexCharts
- Supported chart variants: line, area, bar, column, and pie
- Custom trading table with resizable columns
- Expandable table rows for additional order details
- Pointer-based interactions for drag, resize, and column resizing
- Custom confirmation modal with GSAP motion
- Smooth scrolling with Lenis bound to the actual dashboard scroll container

### Architecture
#### Layout engine
The dashboard layout is powered by a custom layout engine instead of a fixed grid abstraction. It handles:
- panel positioning
- collision resolution
- resize reconciliation
- responsive layout transformation
- auto-arrange behavior
- layout persistence and restore

The layout logic is split into focused modules to keep responsibilities clearer:
- `collisionEngine.ts`
- `responsiveLayout.ts`
- `autoArrange.ts`
- `layoutPersistence.ts`

#### Controller hook
Dashboard orchestration is handled by a controller hook:
- `useDashboardLayoutController.ts`

This hook centralizes non-visual behavior such as:
- drag and resize orchestration
- persistence
- responsive layout derivation
- reset/default restore
- minimized/maximized panel state handling
- animation bookkeeping

`DashboardGrid.tsx` is kept focused on rendering and wiring.

#### Chart system
Charts are rendered through a presenter-style mapping instead of a growing central conditional renderer. The chart layer includes:
- stable widget-based chart identity
- chart view-model normalization
- variant-specific presentation
- shared ApexCharts option generation

This keeps chart rendering extensible while preserving variant-specific UI.

#### Table system
The table is fully custom and optimized for dashboard usage rather than generic data-grid behavior. It includes:
- pointer-based column resizing
- expandable detail rows
- local width persistence
- keyboard-accessible row expansion
- isolated nested scrolling inside the widget

### Interaction Model
This project uses Pointer Events for core interactions instead of mouse-only events.

Why:
- Pointer Events unify mouse, touch, and pen input under one interaction model
- this improves support for tablets and touch-capable devices
- it reduces duplication compared with separate mouse and touch handlers
- it better matches the responsive/customizable dashboard requirement

Pointer-based behavior is used for:
- widget drag
- widget resize
- table column resize

### Testing Strategy
The test strategy focuses on interaction stability and layout correctness.

Coverage includes:
- layout engine behavior
- responsive panel transformation
- collision resolution
- resize stability
- auto-arrange behavior
- modal interaction flows
- pointer-based hook behavior
- dashboard drag/resize integration tests
- table column resize interaction tests
- utility testing for `getDateRange`

The goal is confidence in behavior, not exhaustive low-value coverage.

### Tradeoffs
#### Custom layout engine vs library
A custom layout engine gives tighter control over drag, resize, responsive transformation, and panel state behavior. The tradeoff is higher implementation complexity and a larger long-term maintenance surface compared with using a mature dashboard/grid library.

#### `chartOptions` complexity
Chart flexibility is concentrated in `chartOptions.ts`. This keeps chart styling consistent in one place, but it also makes that file denser than ideal. It is a reasonable tradeoff for the current scope, though future growth would benefit from splitting options by chart family or variant.

#### Table without virtualization
The table is intentionally custom and lightweight for the assignment scope. This keeps implementation clear and tailored to the UI, but it is not yet optimized for very large datasets. If row count grows significantly, virtualization would be the next step.

### Getting Started
#### Prerequisites
- Node.js 18+
- npm

#### Install
```bash
npm install
```

#### Run locally
```bash
cd web
npm run dev
```

#### Run tests
```bash
cd web
npm test
```

#### Build for production
```bash
cd web
npm run build
```

---

## ภาษาไทย

### Overview
โปรเจกต์นี้คือแดชบอร์ดสไตล์ trading ที่ปรับแต่ง layout ได้ สร้างด้วย React และ TailwindCSS โดยเน้นคุณภาพของ interaction, ความยืดหยุ่นของ layout และการจัดโครงสร้างโค้ดให้ดูเป็นงาน frontend ที่พร้อมอธิบายในเชิงสถาปัตยกรรมได้

ภายในประกอบด้วย widget ที่ลากและย่อ/ขยายได้, layout engine แบบ custom, chart หลายรูปแบบด้วย ApexCharts, table แบบ custom, responsive behavior, modal แบบกำหนดเอง และ smooth scrolling ที่ bind กับ scroll container จริงของ dashboard

รายละเอียดฝั่ง backend API ดูได้ที่ `api/README.md`

### Features
- widget ที่ลากและ resize ได้
- custom layout engine โดยไม่ใช้ fixed grid สำเร็จรูป
- ป้องกัน panel overlap ระหว่าง drag/resize
- reset กลับสู่ default layout
- auto-arrange layout
- responsive layout สำหรับ desktop, tablet, mobile
- chart widgets ด้วย ApexCharts
- รองรับ line, area, bar, column และ pie
- custom table ที่ resize ความกว้างคอลัมน์ได้
- expandable rows สำหรับแสดงรายละเอียดเพิ่มเติม
- pointer-based interactions สำหรับ drag, resize และ column resize
- custom confirmation modal แทน native alert/confirm
- animation ด้วย GSAP
- smooth scrolling ด้วย Lenis ที่ผูกกับ scroll container จริงของ dashboard

### Architecture
#### Layout engine
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

#### Controller hook
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

#### Chart system
ระบบ chart ใช้ presenter map แทน conditional branching กลางก้อนเดียว ทำให้เพิ่ม variant ได้ง่ายขึ้น โดยโครงสร้างหลักมี:
- stable chart identity จาก widget id
- view-model สำหรับ normalize ข้อมูล chart
- variant-specific presentation
- shared option builder สำหรับ ApexCharts

#### Table system
table ถูกเขียนแบบ custom เพื่อให้เหมาะกับ dashboard นี้โดยตรง รองรับ:
- pointer-based column resize
- expandable rows
- persistence ของ column width
- keyboard-accessible row expansion
- nested scroll ภายใน widget

### Interaction Model
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

### Testing Strategy
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

### Tradeoffs
#### Custom layout engine vs library
การเขียน layout engine เองช่วยให้ควบคุมพฤติกรรม drag, resize, responsive transformation และ panel state ได้ตรงตามโจทย์มากกว่าใช้ library สำเร็จรูป แต่แลกมาด้วย complexity และ maintenance cost ที่สูงขึ้นในระยะยาว

#### ความซับซ้อนของ `chartOptions`
ความยืดหยุ่นของ chart ถูกรวมศูนย์ไว้ที่ `chartOptions.ts` ทำให้ควบคุม visual behavior ได้สม่ำเสมอ แต่ไฟล์นี้มี conditional complexity สูงกว่าส่วนอื่น หากระบบ chart โตขึ้นควรแยกตาม chart family หรือ variant

#### Table ที่ยังไม่มี virtualization
table ถูกออกแบบให้ชัดและเหมาะกับ scope ของ assignment ก่อน จึงยังไม่ได้ทำ virtualization สำหรับข้อมูลจำนวนมาก หาก scale ของข้อมูลโตขึ้นมาก จุดนี้จะเป็น candidate แรกสำหรับการ optimize

### Getting Started
#### Prerequisites
- Node.js 18+
- npm

#### ติดตั้ง dependencies
```bash
npm install
```

#### รันโปรเจกต์
```bash
cd web
npm run dev
```

#### รัน tests
```bash
cd web
npm test
```

#### build production
```bash
cd web
npm run build
```
