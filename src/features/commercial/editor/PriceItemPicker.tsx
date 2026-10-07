// "Thêm dịch vụ từ bảng giá": searchable list (keyboard arrows / Enter) showing the list price and,
// when the account has one, its negotiated price.
import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { ID } from '@/domain/types';
import { Money } from '@/components/common/money';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { t } from '@/i18n';
import { normalizeText } from '@/lib/utils';
import type { Catalog, CatalogItem } from './draft';

export function PriceItemPicker({ catalog, onPick, disabled }: { catalog: Catalog; onPick: (id: ID) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const needle = normalizeText(query);
    const match = (i: CatalogItem) => !needle || normalizeText(`${i.code} ${i.name} ${i.category}`).includes(needle);
    const out = new Map<string, CatalogItem[]>();
    for (const i of catalog.pickable) {
      if (!match(i)) continue;
      const list = out.get(i.category);
      if (list) list.push(i);
      else out.set(i.category, [i]);
    }
    return [...out.entries()];
  }, [catalog.pickable, query]);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="secondary" disabled={disabled}>
          <Plus aria-hidden="true" />
          {t('commercial.editor.addLine')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(560px,calc(100vw-2rem))] p-0">
        <Command>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={t('commercial.editor.pickerSearch')}
            aria-label={t('commercial.editor.pickerSearch')}
            autoFocus
          />
          <CommandList className="max-h-[min(420px,55dvh)]">
            <CommandEmpty>{t('commercial.editor.pickerEmpty')}</CommandEmpty>
            {groups.map(([category, items]) => (
              <CommandGroup key={category || '-'} heading={category || t('commercial.editor.pickerOther')}>
                {items.map((i) => (
                  <CommandItem
                    key={i.id}
                    value={i.id}
                    onSelect={() => {
                      onPick(i.id);
                      setOpen(false);
                      setQuery('');
                    }}
                    className="items-start gap-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-table font-medium text-foreground">{i.name}</p>
                      <p className="text-caption tabular">
                        {i.code} · {t(`enums.priceUnit.${i.unit}`)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {i.negotiated !== null ? (
                        <>
                          <p className="text-table font-medium text-foreground">
                            <Money value={i.negotiated} />
                          </p>
                          <p className="text-caption">
                            {t('commercial.editor.pickerNegotiated')} · <s>
                              <Money value={i.list_price} />
                            </s>
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-table font-medium text-foreground">
                            <Money value={i.list_price} />
                          </p>
                          <p className="text-caption">{t('commercial.editor.pickerList')}</p>
                        </>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
