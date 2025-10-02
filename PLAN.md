# PLAN: Meta Ads Dashboard (09/2025)

> **Trạng thái tổng thể:** `[IN PROGRESS]`

## 1. Bối cảnh & Mục tiêu `[IN PROGRESS]`
- Ứng dụng Next.js 15/App Router, Clerk auth, Shadcn UI, Tailwind, Zustand, Nuqs, Bun runtime và hệ ORM Prisma kết nối Neon PostgreSQL.
- Mục tiêu giai đoạn này: triển khai luồng quản lý Facebook Ads cơ bản, bỏ qua các tính năng phức tạp như gói dịch vụ, webhook cập nhật role.
- Đảm bảo trải nghiệm dashboard thống nhất với UI component hiện có, hạn chế bổ sung component mới.

## 2. Phạm vi `[IN PROGRESS]`
1. **Xác thực & phiên Facebook** `[TODO]`
   - Giữ Clerk để đăng nhập và lưu metadata tối giản (`facebookTokenStatus`).
   - Không xử lý nâng cấp gói hoặc webhook role.
2. **Kết nối Facebook** `[IN PROGRESS]`
   - Trang `/dashboard/connect-facebook` sử dụng component hiện có (Card, Button, Form) để khởi tạo OAuth Meta.
   - Lưu token/refresh token vào `facebook_tokens` (mã hóa bằng libsodium).
3. **Đồng bộ dữ liệu** `[IN PROGRESS]`
   - Lần đầu: gọi Marketing API v19.0 `/me/adaccounts` rồi `/act_{account_id}/campaigns`, `/campaigns?fields=name,status,objective,start_time,stop_time,daily_budget,effective_status` và tương tự cho ad sets (`/adsets`) cùng ads (`/ads?fields=name,status,creative{id},configured_status`).
   - Thu thập chỉ số chuẩn hóa từ endpoint `/{level}/insights` với `fields=spend,impressions,clicks,cpc,cpp,actions,purchase_roas` và `time_increment=1` để tương thích kế hoạch đo lường mới 2025.
   - Định kỳ 6 giờ bằng Bun cron script dùng worker chung, incremental theo `since/until` dựa trên dấu mốc `sync_jobs`.
   - Bỏ qua tính năng quản lý gói, thông báo qua email.
4. **Dashboard hiển thị** `[IN PROGRESS]`
   - Tận dụng component sẵn có: Tabs, DataTable, Select từ Shadcn UI (hoặc các biến thể đã tồn tại) để tái tạo trải nghiệm giống Ads Manager.
   - Dashboard chính gồm ba tab: **Chiến dịch**, **Nhóm quảng cáo**, **Quảng cáo**. Mỗi tab dùng một DataTable với các cột chuẩn (Tên, Trạng thái, Ngân sách, Chi phí, Hiển thị, CPA/ROAS nếu có dữ liệu) khớp với trường `name`, `status`, `daily_budget`, `spend`, `impressions`, `purchase_roas` của Marketing API.
   - Phía trên Tabs đặt `Select` để người dùng đổi tài khoản quảng cáo; thao tác đổi sẽ trigger server actions revalidate dữ liệu.
   - Hiển thị trạng thái token (còn hạn/hết hạn) và cho phép làm mới thủ công.

## 3. Kiến trúc đề xuất `[IN PROGRESS]`
- **`features/facebook-auth`**
  - `actions/request-login.ts`
  - `actions/callback.ts`
  - `utils/token-validator.ts`
- **`features/facebook-sync`**
  - `actions/manual-refresh.ts`
  - `workers/refresh.worker.ts`
  - `tasks/init-workspace.ts`
- **`lib/prisma`**
  - `client.ts`: Singleton Prisma client cấu hình Neon (sử dụng Data Proxy hoặc `pgbouncer`).
  - `repositories/facebook.ts`: Các hàm truy vấn/bulk upsert chiến dịch, nhóm quảng cáo, quảng cáo, insights.
- **Dữ liệu (Prisma + Neon)**
  - Schema quản lý qua Prisma Migrate, triển khai trên Neon. Sử dụng pool `pgbouncer` thông qua URL Neon.
  - Models chính: `FacebookToken`, `FacebookAdAccount`, `FacebookCampaign`, `FacebookAdSet`, `FacebookAd`, `FacebookInsight`, `SyncJob`.
  - `FacebookInsight` partition theo ngày bằng trường `date` và composite index `(accountId, level, date)`; lưu metric cấp chiến dịch/nhóm/ads, mapping chính xác các trường Marketing API (`campaign_id`, `adset_id`, `ad_id`).
  - Không tạo bảng gói dịch vụ.

## 4. Luồng nghiệp vụ `[IN PROGRESS]`
1. Người dùng đăng nhập bằng Clerk -> `ensureFacebookSession` kiểm tra token qua endpoint `debug_token`.
2. Nếu chưa có/expired -> điều hướng `connect-facebook` để chạy OAuth.
3. Khi token hợp lệ lần đầu -> chạy `initializeAdWorkspace` lưu dữ liệu chiến dịch/nhóm/ads qua Prisma transaction, chuẩn hóa ID theo chuẩn Marketing API (`act_{id}` -> lưu số ID gốc).
4. Cron 6h (`bun run cron:facebook-refresh`) cập nhật insights thông qua batch call `/{account_id}/insights?level=campaign|adset|ad`, nếu lỗi quyền (`error_subcode` 463, 467) -> set `requires_reauth`.
5. Dashboard đọc dữ liệu từ Prisma với filter theo `selectedAdAccountId` và `activeTab`; nếu `requires_reauth` -> hiện banner yêu cầu kết nối lại.

## 5. Lộ trình triển khai `[IN PROGRESS]`
- **Sprint A** `[IN PROGRESS]`: Thiết lập bảng DB, server actions OAuth, lưu token an toàn.
- **Sprint B** `[TODO]`: Hoàn thiện sync lần đầu + dashboard ba tab sử dụng component sẵn có.
- **Sprint C** `[TODO]`: Cron Bun 6h, manual refresh, xử lý token hết hạn.

## 6. Kiểm thử & Vận hành `[TODO]`
- Test tích hợp bằng Bun (`bun run lint`, `bun run test`).
- Ghi log bằng Sentry (đã cấu hình). Không triển khai webhook bổ sung.

## 7. Rủi ro & Giảm thiểu `[IN PROGRESS]`
- **Giới hạn API**: Áp dụng backoff trong worker theo `X-Business-Use-Case-Usage` và `X-App-Usage`.
- **Token hết hạn**: Banner nhắc re-auth, không phụ thuộc vào webhook Clerk.
- **Đồng bộ chậm**: Ưu tiên incremental theo mốc thời gian cuối cùng lưu trong `sync_jobs`.
