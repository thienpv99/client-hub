// Dev-only visual check of the UI kit (overlays, menus, command, toasts). Sample texts are demo data, not UI copy.
import * as React from 'react';
import { toast } from 'sonner';
import {
  Archive,
  Bell,
  Building2,
  CircleAlert,
  FileText,
  LogOut,
  MoreHorizontal,
  Pencil,
  Settings,
  Trash2,
  User,
} from 'lucide-react';
import { normalizeText } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
  SheetMeta,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { Kbd } from '@/components/ui/kbd';

export function OverlayDemos() {
  const [reason, setReason] = React.useState('');
  const [showDone, setShowDone] = React.useState(true);
  const [sort, setSort] = React.useState('due');
  return (
    <div className="flex flex-wrap gap-2 px-4 py-5 sm:px-6">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="secondary">Mở Dialog</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yêu cầu chỉnh sửa</DialogTitle>
            <DialogDescription>Cho New Era biết cần sửa gì trong thiết kế màn hình Đặt hàng.</DialogDescription>
          </DialogHeader>
          <FormField label="Nội dung cần sửa" htmlFor="g-reason" required hint="Tối thiểu 10 ký tự.">
            <Textarea id="g-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ví dụ: đổi vị trí nút Thanh toán…" />
          </FormField>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Hủy</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button disabled={reason.trim().length < 10}>Gửi yêu cầu</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive">
            <Trash2 aria-hidden="true" />
            Xóa việc
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa việc “Khảo sát kho hàng”?</AlertDialogTitle>
            <AlertDialogDescription>Thao tác này không hoàn tác được. Các phụ thuộc liên quan cũng bị gỡ.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction variant="destructive">Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="secondary">Drawer phải</Button>
        </SheetTrigger>
        <SheetContent side="right" mobileFullScreen>
          <SheetHeader className="border-b border-border/70">
            <SheetTitle>Duyệt thiết kế màn hình Đặt hàng</SheetTitle>
            <SheetDescription>App bán hàng đa kênh · Mốc UAT 28/10</SheetDescription>
            <SheetMeta>
              <Badge variant="danger">
                <CircleAlert aria-hidden="true" />
                Đã quá hạn 6 ngày
              </Badge>
              <Badge variant="primary">Chờ anh duyệt</Badge>
              <span>Người làm: Trần Quang Minh</span>
            </SheetMeta>
          </SheetHeader>
          <SheetBody className="space-y-4 pt-4 md:pt-6">
            {Array.from({ length: 14 }, (_, i) => (
              <p key={i} className="text-body text-muted-foreground">
                Đoạn nội dung mẫu {i + 1}: nếu chưa duyệt trước 15/10, team New Era chưa thể lập trình phần Đặt hàng.
              </p>
            ))}
          </SheetBody>
          <SheetFooter>
            <SheetClose asChild>
              <Button variant="secondary">Yêu cầu sửa</Button>
            </SheetClose>
            <SheetClose asChild>
              <Button>Duyệt</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="secondary">Menu trái</Button>
        </SheetTrigger>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Client Hub</SheetTitle>
            <SheetDescription>Điều hướng</SheetDescription>
          </SheetHeader>
          <SheetBody className="grid gap-1">
            {['Tổng quan', 'Khách hàng', 'Việc', 'Thương mại', 'Cài đặt'].map((label) => (
              <Button key={label} variant="ghost" className="justify-start">
                {label}
              </Button>
            ))}
          </SheetBody>
        </SheetContent>
      </Sheet>

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="secondary">Sheet dưới</Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="mx-auto sm:max-w-xl">
          <SheetHeader className="pt-2 md:pt-3">
            <SheetTitle>Lọc việc</SheetTitle>
            <SheetDescription>Kéo tay nắm xuống để đóng.</SheetDescription>
          </SheetHeader>
          <SheetBody className="space-y-4">
            <Input placeholder="Tìm theo tên việc" aria-label="Tìm theo tên việc" />
            <FormField label="Ghi chú" htmlFor="g-sheet-note" hint="Không bắt buộc.">
              <Textarea id="g-sheet-note" rows={2} />
            </FormField>
          </SheetBody>
          <SheetFooter>
            <SheetClose asChild>
              <Button variant="secondary">Xóa lọc</Button>
            </SheetClose>
            <SheetClose asChild>
              <Button>Áp dụng</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" aria-label="Thêm thao tác">
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Việc</DropdownMenuLabel>
          <DropdownMenuItem>
            <Pencil aria-hidden="true" />
            Sửa
            <DropdownMenuShortcut>E</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Archive aria-hidden="true" />
            Lưu trữ
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <FileText aria-hidden="true" />
            Xuất PDF
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={showDone} onCheckedChange={(v) => setShowDone(v === true)}>
            Hiện việc đã xong
          </DropdownMenuCheckboxItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Sắp xếp</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
                <DropdownMenuRadioItem value="due">Theo hạn</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="priority">Theo mức ưu tiên</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">
            <Trash2 aria-hidden="true" />
            Xóa
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">Popover</Button>
        </PopoverTrigger>
        <PopoverContent className="space-y-1.5">
          <p className="font-medium text-foreground">Vì sao mốc lùi?</p>
          <p className="text-muted-foreground">Kế hoạch 28/10 → Dự báo 03/11 · do chờ duyệt thiết kế 6 ngày.</p>
        </PopoverContent>
      </Popover>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Thông báo">
            <Bell aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Thông báo</TooltipContent>
      </Tooltip>
    </div>
  );
}

const SEARCH_ITEMS = [
  { id: 'acc_coxanh', group: 'Khách hàng', label: 'Cỏ Xanh Retail', icon: Building2 },
  { id: 'acc_thinhan', group: 'Khách hàng', label: 'Ngân hàng Thịnh An', icon: Building2 },
  { id: 'acc_giongan', group: 'Khách hàng', label: 'Năng lượng Gió Ngàn', icon: Building2 },
  { id: 't1', group: 'Việc', label: 'Duyệt thiết kế màn hình Đặt hàng', icon: FileText },
  { id: 't2', group: 'Việc', label: 'Cung cấp danh mục sản phẩm và giá bán', icon: FileText },
  { id: 'u1', group: 'Người dùng', label: 'Trần Quang Minh', icon: User },
  { id: 'u2', group: 'Người dùng', label: 'Phạm Thu Lan', icon: User, disabled: true },
] as const;

function SearchResults({ query, onPick }: { query: string; onPick: (label: string) => void }) {
  const q = normalizeText(query);
  const matches = SEARCH_ITEMS.filter((item) => normalizeText(item.label).includes(q));
  const groups = Array.from(new Set(matches.map((m) => m.group)));
  return (
    <CommandList>
      <CommandEmpty>Không tìm thấy kết quả cho “{query}”.</CommandEmpty>
      {groups.map((group, gi) => (
        <React.Fragment key={group}>
          {gi > 0 && <CommandSeparator />}
          <CommandGroup heading={group}>
            {matches
              .filter((m) => m.group === group)
              .map((m) => {
                const Icon = m.icon;
                return (
                  <CommandItem key={m.id} value={m.id} disabled={'disabled' in m && m.disabled} onSelect={() => onPick(m.label)}>
                    <Icon aria-hidden="true" />
                    {m.label}
                    {m.group === 'Khách hàng' && <CommandShortcut>↵</CommandShortcut>}
                  </CommandItem>
                );
              })}
          </CommandGroup>
        </React.Fragment>
      ))}
    </CommandList>
  );
}

export function CommandDemo() {
  const [query, setQuery] = React.useState('');
  const [picked, setPicked] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [dialogQuery, setDialogQuery] = React.useState('');
  return (
    <div className="grid gap-4 px-4 py-5 sm:px-6 md:grid-cols-2">
      <div className="space-y-2">
        <Command className="border border-border/70 shadow-card" aria-label="Tìm nhanh">
          <CommandInput value={query} onValueChange={setQuery} placeholder="Tìm khách hàng, việc, người…" aria-label="Tìm nhanh" />
          <SearchResults query={query} onPick={setPicked} />
        </Command>
        <p className="text-caption" data-testid="command-picked">
          Đã chọn: {picked ?? '—'}
        </p>
      </div>
      <div className="flex items-start gap-2">
        <Button variant="secondary" onClick={() => setOpen(true)}>
          <Settings aria-hidden="true" />
          Mở CommandDialog
          <Kbd>Ctrl K</Kbd>
        </Button>
        <CommandDialog open={open} onOpenChange={setOpen} title="Tìm nhanh">
          <CommandInput value={dialogQuery} onValueChange={setDialogQuery} placeholder="Tìm nhanh…" aria-label="Tìm nhanh" />
          <SearchResults
            query={dialogQuery}
            onPick={(label) => {
              setPicked(label);
              setOpen(false);
            }}
          />
        </CommandDialog>
      </div>
    </div>
  );
}

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-2 px-4 py-5 sm:px-6">
      <Button
        variant="secondary"
        onClick={() =>
          toast.success('Đã duyệt. New Era đã nhận được thông báo.', {
            action: { label: 'Hoàn tác', onClick: () => toast('Đã hoàn tác.') },
          })
        }
      >
        Toast thành công
      </Button>
      <Button variant="secondary" onClick={() => toast.error('Không gửi được. Vui lòng thử lại.')}>
        Toast lỗi
      </Button>
      <Button variant="secondary" onClick={() => toast.info('Đã gửi nhắc cho khách.', { description: 'Email sẽ đến trong vài phút.' })}>
        Toast thông tin
      </Button>
      <Button variant="secondary" onClick={() => toast('Đã lưu thay đổi.')}>
        Toast thường
      </Button>
      <Button variant="ghost" onClick={() => toast.dismiss()}>
        <LogOut aria-hidden="true" />
        Đóng tất cả
      </Button>
    </div>
  );
}
