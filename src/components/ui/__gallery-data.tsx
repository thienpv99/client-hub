// Dev-only visual check of the UI kit (tabs, toggles, table, avatar, progress, skeleton, kbd, scroll area).
// Sample texts are demo data, not UI copy.
import * as React from 'react';
import { CalendarDays, LayoutGrid, List, MoreHorizontal, OctagonAlert, TriangleAlert, CircleCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Section, Specimen } from '@/components/ui/__gallery-parts';

const PAGE_TABS: { id: string; label: string; count?: number; tone?: 'danger' }[] = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'tasks', label: 'Việc', count: 18 },
  { id: 'roadmap', label: 'Lộ trình' },
  { id: 'sales', label: 'Bán hàng', count: 2 },
  { id: 'commercial', label: 'Thương mại', count: 1, tone: 'danger' },
  { id: 'documents', label: 'Tài liệu' },
  { id: 'contacts', label: 'Liên hệ' },
  { id: 'activity', label: 'Hoạt động' },
];

export function NavSection() {
  const [view, setView] = React.useState('list');
  return (
    <Section id="g-nav" title="Tabs · ToggleGroup" description="Tab trang = gạch chân 2px. Trong thẻ = segmented (nền xám, ô đang chọn trắng).">
      <Specimen label="Underline + counts" stack>
        <Tabs defaultValue="overview">
          <TabsList variant="underline" aria-label="Trang account">
            {PAGE_TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} count={tab.count} countTone={tab.tone}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {PAGE_TABS.map((tab) => (
            <TabsContent key={tab.id} value={tab.id}>
              <p className="text-table text-muted-foreground">Nội dung tab {tab.label}.</p>
            </TabsContent>
          ))}
        </Tabs>
      </Specimen>
      <Specimen label="Segmented" stack>
        <Tabs defaultValue="open">
          <TabsList variant="segmented" aria-label="Lọc việc">
            <TabsTrigger value="open" count={5}>
              Đang mở
            </TabsTrigger>
            <TabsTrigger value="waiting" count={3}>
              Chờ khách
            </TabsTrigger>
            <TabsTrigger value="done">Đã xong</TabsTrigger>
            <TabsTrigger value="off" disabled>
              Bị khóa
            </TabsTrigger>
          </TabsList>
          <TabsContent value="open">
            <p className="text-table text-muted-foreground">5 việc đang mở.</p>
          </TabsContent>
          <TabsContent value="waiting">
            <p className="text-table text-muted-foreground">3 việc đang chờ khách.</p>
          </TabsContent>
          <TabsContent value="done">
            <p className="text-table text-muted-foreground">12 việc đã xong.</p>
          </TabsContent>
        </Tabs>
      </Specimen>
      <Specimen label="ToggleGroup">
        <ToggleGroup type="single" variant="segmented" value={view} onValueChange={(v) => v && setView(v)} aria-label="Kiểu xem">
          <ToggleGroupItem value="list" aria-label="Danh sách">
            <List aria-hidden="true" />
            Danh sách
          </ToggleGroupItem>
          <ToggleGroupItem value="board" aria-label="Bảng">
            <LayoutGrid aria-hidden="true" />
            Bảng
          </ToggleGroupItem>
          <ToggleGroupItem value="timeline" aria-label="Lịch">
            <CalendarDays aria-hidden="true" />
            Lịch
          </ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup type="multiple" variant="outline" defaultValue={['client']} aria-label="Bên">
          <ToggleGroupItem value="client">Khách</ToggleGroupItem>
          <ToggleGroupItem value="internal">New Era</ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup type="single" defaultValue="week" size="sm" aria-label="Khoảng thời gian">
          <ToggleGroupItem value="week">Tuần</ToggleGroupItem>
          <ToggleGroupItem value="month">Tháng</ToggleGroupItem>
          <ToggleGroupItem value="quarter">Quý</ToggleGroupItem>
        </ToggleGroup>
      </Specimen>
    </Section>
  );
}

const DEMO_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 36 36'><rect width='36' height='36' fill='rgb(238,243,255)'/><circle cx='18' cy='14' r='6' fill='rgb(29,78,216)'/><path d='M6 34c2-7 7-10 12-10s10 3 12 10z' fill='rgb(29,78,216)'/></svg>",
  );

const ROWS = [
  { id: 'cx', name: 'Cỏ Xanh Retail', tier: 'Chiến lược', initials: 'CX', stage: 'Triển khai', health: 'danger', value: '1.250.000.000 ₫', due: 'Quá hạn 6 ngày' },
  { id: 'ta', name: 'Ngân hàng Thịnh An', tier: 'Chiến lược', initials: 'TA', stage: 'Đàm phán', health: 'warning', value: '850.000.000 ₫', due: 'Còn 2 ngày' },
  { id: 'tt', name: 'Cơ điện Thiên Trường', tier: 'Trọng điểm', initials: 'TT', stage: 'Triển khai', health: 'warning', value: '420.500.000 ₫', due: 'Còn 9 ngày' },
  { id: 'gn', name: 'Năng lượng Gió Ngàn', tier: 'Trọng điểm', initials: 'GN', stage: 'Triển khai', health: 'danger', value: '690.000.000 ₫', due: 'Quá hạn 4 ngày' },
  { id: 'hd', name: 'Địa ốc Hải Đăng', tier: 'Tiêu chuẩn', initials: 'HĐ', stage: 'Triển khai', health: 'warning', value: '275.000.000 ₫', due: 'Còn 2 ngày' },
  { id: 'mt', name: 'Mây Trắng Logistics', tier: 'Tiêu chuẩn', initials: 'MT', stage: 'Vận hành', health: 'success', value: '310.000.000 ₫', due: 'Còn 21 ngày' },
] as const;

const HEALTH = {
  danger: { label: 'Đang bị chặn', icon: OctagonAlert },
  warning: { label: 'Cần chú ý', icon: TriangleAlert },
  success: { label: 'Đúng kế hoạch', icon: CircleCheck },
} as const;

function DemoTable() {
  const [selected, setSelected] = React.useState<string[]>(['cx']);
  const all = selected.length === ROWS.length;
  return (
    <Card className="overflow-hidden">
      <Table stickyHeader wrapperClassName="max-h-[320px]">
        <TableCaption className="sr-only">6 khách hàng</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Checkbox
                aria-label="Chọn tất cả"
                checked={all ? true : selected.length > 0 ? 'indeterminate' : false}
                onCheckedChange={(v) => setSelected(v === true ? ROWS.map((r) => r.id) : [])}
              />
            </TableHead>
            <TableHead>Khách hàng</TableHead>
            <TableHead>Giai đoạn</TableHead>
            <TableHead>Sức khỏe</TableHead>
            <TableHead className="text-right">Giá trị hợp đồng</TableHead>
            <TableHead>Hạn gần nhất</TableHead>
            <TableHead>
              <span className="sr-only">Thao tác</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ROWS.map((row) => {
            const h = HEALTH[row.health];
            const Icon = h.icon;
            const isSelected = selected.includes(row.id);
            return (
              <TableRow key={row.id} data-state={isSelected ? 'selected' : undefined} className="group">
                <TableCell>
                  <Checkbox
                    aria-label={`Chọn ${row.name}`}
                    checked={isSelected}
                    onCheckedChange={(v) => setSelected((s) => (v === true ? [...s, row.id] : s.filter((x) => x !== row.id)))}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-micro font-semibold text-primary">
                      {row.initials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{row.name}</p>
                      <p className="text-caption">{row.tier}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{row.stage}</TableCell>
                <TableCell>
                  <Badge variant={row.health} size="sm">
                    <Icon aria-hidden="true" />
                    {h.label}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-right font-medium">{row.value}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{row.due}</TableCell>
                <TableCell className="w-12 text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Thao tác cho ${row.name}`}
                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 [@media(pointer:coarse)]:opacity-100"
                  >
                    <MoreHorizontal aria-hidden="true" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={4} className="h-12 text-muted-foreground">
              Tổng 6 hợp đồng
            </TableCell>
            <TableCell className="h-12 whitespace-nowrap text-right">3.795.500.000 ₫</TableCell>
            <TableCell colSpan={2} className="h-12" />
          </TableRow>
        </TableFooter>
      </Table>
    </Card>
  );
}

export function DataSections() {
  return (
    <>
      <Section id="g-table" title="Table" description="Nằm trong thẻ, đầu bảng nền nhạt 12px, dòng 56px, số căn phải. Đầu bảng dính khi cuộn.">
        <div className="bg-background/60 p-4 sm:p-6">
          <DemoTable />
        </div>
      </Section>
      <Section id="g-misc" title="Avatar · Progress · Skeleton · Kbd · ScrollArea">
        <Specimen label="Avatar">
          <Avatar size="xs">
            <AvatarFallback>QM</AvatarFallback>
          </Avatar>
          <Avatar size="sm">
            <AvatarFallback>QM</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarImage src={DEMO_AVATAR} alt="New Era" />
            <AvatarFallback>NE</AvatarFallback>
          </Avatar>
          <Avatar size="lg">
            <AvatarFallback>TL</AvatarFallback>
          </Avatar>
          <AvatarGroup>
            {['HN', 'TA', 'MT', 'PL'].map((i) => (
              <Avatar key={i} size="sm">
                <AvatarFallback>{i}</AvatarFallback>
              </Avatar>
            ))}
          </AvatarGroup>
        </Specimen>
        <Specimen label="Progress" stack>
          <div className="flex max-w-md items-center gap-3">
            <Progress value={62} aria-label="Tiến độ dự án" />
            <span className="w-10 text-right text-caption tabular">62%</span>
          </div>
          <div className="flex max-w-md items-center gap-3">
            <Progress value={100} indicatorClassName="bg-success" aria-label="Hoàn thành" />
            <span className="w-10 text-right text-caption tabular">100%</span>
          </div>
          <Progress value={null} size="md" className="max-w-md" aria-label="Chưa xác định" />
        </Specimen>
        <Specimen label="Skeleton" stack>
          <div className="grid max-w-2xl gap-4 sm:grid-cols-2" aria-busy="true">
            <div className="flex items-center gap-3 rounded-xl border border-border/70 p-4">
              <Skeleton className="h-9 w-9 rounded-full" />
              <SkeletonText className="flex-1" />
            </div>
            <div className="space-y-2 rounded-xl border border-border/70 p-4">
              <Skeleton className="h-3 w-2/5 rounded-full" />
              <Skeleton className="h-9 w-3/5" />
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          </div>
        </Specimen>
        <Specimen label="Kbd · ScrollArea">
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
          <KbdGroup>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            <Kbd>↵</Kbd>
            <Kbd>Esc</Kbd>
          </KbdGroup>
          <ScrollArea className="h-40 w-full max-w-md rounded-lg border border-border/70">
            <div className="px-4 py-2">
              {Array.from({ length: 16 }, (_, i) => (
                <React.Fragment key={i}>
                  <p className="py-2 text-table">
                    <span className="font-medium">Trần Quang Minh</span>
                    <span className="text-muted-foreground"> đã duyệt “Thiết kế {i + 1}”</span>
                  </p>
                  {i < 15 && <Separator />}
                </React.Fragment>
              ))}
            </div>
          </ScrollArea>
        </Specimen>
      </Section>
    </>
  );
}
