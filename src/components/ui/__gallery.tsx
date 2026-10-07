// Dev-only visual check of the UI kit: every primitive in its main states. Sample texts are demo data, not UI copy.
// Render: createRoot(el).render(React.createElement((await import('/src/components/ui/__gallery')).UiGallery))
import * as React from 'react';
import {
  ArrowRight,
  CalendarClock,
  CircleCheck,
  Clock3,
  Info,
  Lock,
  MoreHorizontal,
  OctagonAlert,
  Plus,
  Search,
  StickyNote,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FormField } from '@/components/ui/form-field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { CommandDemo, OverlayDemos, ToastDemo } from '@/components/ui/__gallery-overlays';
import { DataSections, NavSection } from '@/components/ui/__gallery-data';
import { FileUploadDemo, GALLERY_SECTIONS, Section, Specimen } from '@/components/ui/__gallery-parts';

const VARIANTS = ['default', 'secondary', 'outline', 'ghost', 'soft', 'link', 'destructive'] as const;
const BADGES = ['default', 'primary', 'outline', 'note'] as const;

function ButtonsSection() {
  return (
    <Section id="g-buttons" title="Button" description="Một nút chính cho mỗi vùng. Nhấn: thu nhỏ 2 %, focus: vòng xanh.">
      <Specimen label="Variants">
        {VARIANTS.map((v) => (
          <Button key={v} variant={v}>
            {v}
          </Button>
        ))}
      </Specimen>
      <Specimen label="Sizes">
        <Button size="sm">Nhỏ</Button>
        <Button>Mặc định</Button>
        <Button size="lg">Lớn</Button>
        <Button size="touch">Cảm ứng 44px</Button>
        <Button size="icon" aria-label="Thêm việc">
          <Plus aria-hidden="true" />
        </Button>
        <Button size="icon" variant="ghost" aria-label="Thêm thao tác">
          <MoreHorizontal aria-hidden="true" />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Thao tác dòng">
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </Specimen>
      <Specimen label="With icons · states">
        <Button>
          <CircleCheck aria-hidden="true" />
          Duyệt thiết kế
        </Button>
        <Button variant="secondary">
          <Upload aria-hidden="true" />
          Tải file
        </Button>
        <Button variant="soft">
          <CalendarClock aria-hidden="true" />
          Đặt lịch
        </Button>
        <Button variant="link">
          Xem tất cả
          <ArrowRight aria-hidden="true" />
        </Button>
        <Button loading>Đang gửi…</Button>
        <Button variant="secondary" disabled>
          Không khả dụng
        </Button>
        <Button size="icon" variant="secondary" loading aria-label="Đang tải" />
        <Button asChild variant="outline">
          <a href="#g-table">Liên kết dạng nút</a>
        </Button>
      </Specimen>
      <Specimen label="Mobile primary">
        <div className="w-full max-w-sm space-y-2">
          <Button size="touch" className="w-full">
            Xem &amp; duyệt
          </Button>
          <div className="flex justify-center gap-4">
            <Button variant="link" size="sm">
              Yêu cầu chỉnh sửa
            </Button>
            <Button variant="link" size="sm">
              Giao cho đồng nghiệp
            </Button>
          </div>
        </div>
      </Specimen>
    </Section>
  );
}

function BadgesSection() {
  return (
    <Section id="g-badges" title="Badge" description="Pill 24px. Màu trạng thái luôn đi kèm icon (hoặc chấm) và chữ.">
      <Specimen label="Neutral">
        {BADGES.map((b) => (
          <Badge key={b} variant={b}>
            {b === 'note' ? <Lock aria-hidden="true" /> : null}
            {b === 'note' ? 'Chỉ nội bộ' : b}
          </Badge>
        ))}
        <Badge variant="outline">Chiến lược</Badge>
      </Specimen>
      <Specimen label="Status · icon">
        <Badge variant="success">
          <CircleCheck aria-hidden="true" />
          Đúng kế hoạch
        </Badge>
        <Badge variant="warning">
          <TriangleAlert aria-hidden="true" />
          Cần chú ý
        </Badge>
        <Badge variant="danger">
          <OctagonAlert aria-hidden="true" />
          Đang bị chặn
        </Badge>
        <Badge variant="primary">
          <Clock3 aria-hidden="true" />
          Chờ anh duyệt
        </Badge>
      </Specimen>
      <Specimen label="Status · dot (dense)">
        <Badge variant="success" dot size="sm">
          Đã thu
        </Badge>
        <Badge variant="warning" dot size="sm">
          Còn 2 ngày
        </Badge>
        <Badge variant="danger" dot size="sm">
          Quá hạn 12 ngày
        </Badge>
        <Badge dot size="sm">
          Chưa đến hạn
        </Badge>
      </Specimen>
    </Section>
  );
}

function CardsSection() {
  return (
    <Section id="g-cards" title="Card" description="Viền 70 %, bóng rất nhẹ. Thẻ bấm được nhấc 1px khi rê chuột.">
      <div className="grid gap-4 bg-background/60 p-4 sm:p-6 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Cỏ Xanh Retail</CardTitle>
            <CardDescription>Đang chờ khách: 3 · Đang chờ New Era: 2</CardDescription>
            <CardAction>
              <Button variant="ghost" size="icon-sm" aria-label="Thêm thao tác">
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-table text-muted-foreground">Mốc UAT 28/10 dự báo lùi 6 ngày do chờ duyệt thiết kế.</p>
          </CardContent>
          <CardFooter className="justify-between">
            <span className="text-caption">Cập nhật 2 giờ trước</span>
            <Button variant="link" size="sm">
              Chi tiết
              <ArrowRight aria-hidden="true" />
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardContent>
            <p className="flex items-center gap-2 text-caption font-medium">Công nợ quá hạn</p>
            <p className="mt-2 text-kpi font-semibold tracking-display tabular text-ink">1,25 tỷ ₫</p>
            <p className="mt-1 flex items-center gap-1.5 text-[13px] leading-[18px] text-danger">
              <OctagonAlert className="h-3.5 w-3.5" aria-hidden="true" />2 đợt · quá hạn 12 ngày
            </p>
            <Progress value={64} className="mt-4" aria-label="Đã thu 64 %" />
          </CardContent>
        </Card>

        <Card interactive asChild>
          <a href="#g-cards" className="text-left">
            <CardHeader>
              <CardTitle>Thẻ bấm được</CardTitle>
              <CardDescription>interactive + asChild (thẻ là một liên kết)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant="success">
                  <CircleCheck aria-hidden="true" />
                  Đúng kế hoạch
                </Badge>
                <span className="text-caption">Go-live 15/12</span>
              </div>
            </CardContent>
          </a>
        </Card>
      </div>
    </Section>
  );
}

function AlertsSection() {
  return (
    <Section id="g-alerts" title="Alert" description="Nền nhạt, viền mảnh, icon 18px. Không dùng khối màu đậm.">
      <Specimen label="Variants" stack>
        <Alert>
          <Info />
          <AlertTitle>Mặc định</AlertTitle>
          <AlertDescription>Thông tin trung tính, không cần hành động.</AlertDescription>
        </Alert>
        <Alert variant="info">
          <Info />
          <AlertTitle>Đang xem như khách hàng</AlertTitle>
          <AlertDescription>Mọi thao tác ở chế độ chỉ xem.</AlertDescription>
        </Alert>
        <Alert variant="success">
          <CircleCheck />
          <AlertTitle>Đúng kế hoạch</AlertTitle>
        </Alert>
        <Alert variant="warning">
          <TriangleAlert />
          <AlertTitle>Cần chú ý</AlertTitle>
          <AlertDescription>1 việc còn 2 ngày, đang giữ mốc Go-live.</AlertDescription>
        </Alert>
        <Alert variant="danger">
          <OctagonAlert />
          <AlertTitle>Đang chờ anh duyệt 1 việc</AlertTitle>
          <AlertDescription>Mốc Go-live dự báo lùi 6 ngày.</AlertDescription>
        </Alert>
        <Alert variant="note">
          <StickyNote />
          <AlertDescription>Ghi chú nội bộ: khách ưu tiên ra mắt trước Tết.</AlertDescription>
        </Alert>
      </Specimen>
    </Section>
  );
}

function FormsSection() {
  const [name, setName] = React.useState('');
  const [notify, setNotify] = React.useState(true);
  return (
    <Section id="g-forms" title="Form" description="Nhãn 14px ở trên, gợi ý 13px, lỗi màu đỏ kèm icon. Focus: viền xanh + quầng nhạt.">
      <Specimen label="Fields" className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-2">
        <FormField label="Tên việc" htmlFor="g-name" required hint="Viết 1 câu, lời thường.">
          <Input id="g-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Duyệt thiết kế" />
        </FormField>
        <FormField label="Email" htmlFor="g-email" error={name.length > 0 ? undefined : 'Email chưa đúng định dạng.'}>
          <Input id="g-email" type="email" defaultValue="minh@" />
        </FormField>
        <FormField label="Giai đoạn" htmlFor="g-stage">
          <Select defaultValue="impl">
            <SelectTrigger id="g-stage">
              <SelectValue placeholder="Chọn giai đoạn" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Giai đoạn</SelectLabel>
                <SelectItem value="lead">Tiềm năng</SelectItem>
                <SelectItem value="nego">Đàm phán</SelectItem>
                <SelectItem value="impl">Triển khai</SelectItem>
                <SelectItem value="ops" disabled>
                  Vận hành
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Mức ưu tiên (native)" htmlFor="g-tier" labelAside="Không bắt buộc">
          <NativeSelect id="g-tier" defaultValue="" placeholder="Chọn mức">
            <option value="strategic">Chiến lược</option>
            <option value="key">Trọng điểm</option>
            <option value="standard">Tiêu chuẩn</option>
          </NativeSelect>
        </FormField>
        <FormField label="Ghi chú" htmlFor="g-note" className="md:col-span-2">
          <Textarea id="g-note" placeholder="Nội dung ghi chú…" />
        </FormField>
      </Specimen>
      <Specimen label="Sizes · toolbar">
        <Input icon={<Search />} inputSize="sm" placeholder="Tìm khách hàng…" aria-label="Tìm khách hàng" wrapperClassName="w-full sm:w-[280px]" />
        <Select defaultValue="all">
          <SelectTrigger size="sm" className="w-auto min-w-[140px]" aria-label="Sức khỏe">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mọi trạng thái</SelectItem>
            <SelectItem value="blocked">Đang bị chặn</SelectItem>
          </SelectContent>
        </Select>
        <NativeSelect size="sm" defaultValue="am" aria-label="Phụ trách" wrapperClassName="w-auto">
          <option value="am">Mọi AM</option>
          <option value="ha">Nguyễn Thu Hà</option>
        </NativeSelect>
        <Input inputSize="lg" placeholder="Ô lớn 48px" aria-label="Ô lớn" className="sm:w-56" />
      </Specimen>
      <Specimen label="States">
        <Input aria-label="Ô bị khóa" disabled value="Không sửa được" readOnly className="sm:w-56" />
        <Input aria-label="Chỉ đọc" value="Chỉ đọc" readOnly className="sm:w-56" />
        <FileUploadDemo />
      </Specimen>
      <Specimen label="Choice controls">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <div className="flex items-center gap-3">
            <Switch id="g-notify" checked={notify} onCheckedChange={setNotify} />
            <Label htmlFor="g-notify">Nhận email nhắc việc</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="g-off" disabled />
            <Label htmlFor="g-off">Tắt</Label>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox id="g-c1" defaultChecked />
            <Label htmlFor="g-c1">Đã chọn</Label>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox id="g-c2" checked="indeterminate" />
            <Label htmlFor="g-c2">Một phần</Label>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox id="g-c3" />
            <Label htmlFor="g-c3">Chưa chọn</Label>
          </div>
          <RadioGroup defaultValue="client" className="flex gap-6" aria-label="Bên thực hiện">
            <div className="flex items-center gap-3">
              <RadioGroupItem value="client" id="g-r1" />
              <Label htmlFor="g-r1">Khách</Label>
            </div>
            <div className="flex items-center gap-3">
              <RadioGroupItem value="internal" id="g-r2" />
              <Label htmlFor="g-r2">New Era</Label>
            </div>
          </RadioGroup>
        </div>
      </Specimen>
    </Section>
  );
}

export function UiGallery() {
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:space-y-8 md:px-6 md:py-10">
          <header className="space-y-4">
            <div>
              <p className="text-micro font-medium text-primary">Executive Calm · v2</p>
              <h1 className="mt-1 text-title font-semibold tracking-display text-ink md:text-display">UI kit</h1>
              <p className="mt-1 max-w-reading text-body text-muted-foreground">
                Mọi thành phần cơ bản và trạng thái của chúng — bề mặt yên, phân cấp rõ, số nổi bật.
              </p>
            </div>
            <nav aria-label="Mục lục" className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
              {GALLERY_SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="touch-tap inline-flex h-8 shrink-0 items-center rounded-full border border-border/70 bg-card px-3 text-caption font-medium shadow-xs transition-colors hover:border-border-strong hover:text-foreground"
                >
                  {s.label}
                </a>
              ))}
            </nav>
          </header>
          <ButtonsSection />
          <BadgesSection />
          <CardsSection />
          <AlertsSection />
          <FormsSection />
          <NavSection />
          <DataSections />
          <Section id="g-overlays" title="Overlay" description="Dialog · AlertDialog · Sheet (phải / trái / dưới có tay kéo) · DropdownMenu · Popover · Tooltip">
            <OverlayDemos />
          </Section>
          <Section id="g-command" title="Command" description="Danh sách tìm nhanh: tiêu đề nhóm 12px, dòng 40px, dòng đang chọn nền xám.">
            <CommandDemo />
          </Section>
          <Section id="g-toast" title="Toast" description="Thẻ trắng, icon trạng thái trong vòng tròn nhạt, hành động chính màu xanh.">
            <ToastDemo />
          </Section>
        </main>
        <Toaster />
      </div>
    </TooltipProvider>
  );
}
