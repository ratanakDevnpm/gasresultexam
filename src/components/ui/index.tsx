import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Inbox,
  X,
} from 'lucide-react';

// 1. Button
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'gold';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}) => {
  const variantClasses: Record<ButtonVariant, string> = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs border border-indigo-600',
    secondary: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200',
    outline: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs',
    ghost: 'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-transparent',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs border border-rose-600',
    gold: 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-xs border border-amber-500',
  };

  const sizeClasses: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-xs',
    lg: 'px-5 py-2.5 text-sm',
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-khmer-body ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : leftIcon}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </button>
  );
};

// 2. Input
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  helperText,
  error,
  leftIcon,
  id,
  className = '',
  ...rest
}) => {
  const inputId = id || `input-${label?.replace(/\s+/g, '-').toLowerCase() || 'field'}`;
  return (
    <div className="w-full space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-slate-900 font-khmer-body">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          className={`w-full ${leftIcon ? 'pl-9 pr-3' : 'px-3'} py-2 text-xs bg-white text-slate-900 border rounded-lg transition-colors focus:outline-none focus:ring-2 font-khmer-body ${
            error
              ? 'border-rose-300 focus:border-rose-600 focus:ring-rose-500/20'
              : 'border-slate-200 focus:border-indigo-600 focus:ring-indigo-500/20'
          } ${className}`}
          {...rest}
        />
      </div>
      {error ? (
        <p className="text-[11px] text-rose-600 font-khmer-body">{error}</p>
      ) : helperText ? (
        <p className="text-[11px] text-slate-400 font-khmer-body">{helperText}</p>
      ) : null}
    </div>
  );
};

// 3. Select
export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  helperText?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  options,
  error,
  helperText,
  id,
  className = '',
  ...rest
}) => {
  const selectId = id || `select-${label?.replace(/\s+/g, '-').toLowerCase() || 'field'}`;
  return (
    <div className="w-full space-y-1">
      {label && (
        <label htmlFor={selectId} className="block text-xs font-semibold text-slate-900 font-khmer-body">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`w-full px-3 py-2 text-xs bg-white text-slate-900 border rounded-lg transition-colors focus:outline-none focus:ring-2 font-khmer-body ${
          error
            ? 'border-rose-300 focus:border-rose-600 focus:ring-rose-500/20'
            : 'border-slate-200 focus:border-indigo-600 focus:ring-indigo-500/20'
        } ${className}`}
        {...rest}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error ? (
        <p className="text-[11px] text-rose-600 font-khmer-body">{error}</p>
      ) : helperText ? (
        <p className="text-[11px] text-slate-400 font-khmer-body">{helperText}</p>
      ) : null}
    </div>
  );
};

// 4. DatePicker
export interface DatePickerProps extends Omit<InputProps, 'type'> {
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
}

export const DatePicker: React.FC<DatePickerProps> = (props) => {
  return <Input type="date" className="font-mono-tabular" {...props} />;
};

// 5. Card
export interface CardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  headerAction,
  footer,
  children,
  className = '',
  noPadding = false,
}) => {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden ${className}`}>
      {(title || subtitle || headerAction) && (
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            {title && <h3 className="text-base font-bold text-slate-900 font-khmer-body">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-600 font-khmer-body mt-0.5">{subtitle}</p>}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-5'}>{children}</div>
      {footer && (
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
          {footer}
        </div>
      )}
    </div>
  );
};

// 6. Badge (Semantic Status Component aligned with Global Design System)
export type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral' | 'indigo';

export interface BadgeProps {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ tone = 'neutral', children, className = '' }) => {
  const toneStyles: Record<BadgeTone, string> = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-300',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold border rounded-md whitespace-nowrap font-khmer-body ${toneStyles[tone]} ${className}`}
    >
      {children}
    </span>
  );
};

// 7. DataTable
export interface DataTableColumn<T> {
  key: string;
  header: string;
  khmerSubHeader?: string;
  align?: 'left' | 'center' | 'right';
  render?: (row: T, rowIndex: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T, index: number) => string;
  emptyMessage?: string;
  maxHeightClass?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  emptyMessage = 'មិនមានទិន្នន័យត្រូវបង្ហាញឡើយ។ (No records found)',
  maxHeightClass = 'max-h-[480px]',
}: DataTableProps<T>) {
  return (
    <div className={`overflow-x-auto ${maxHeightClass}`}>
      <table className="w-full text-left border-collapse text-xs">
        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`py-2.5 px-3.5 font-semibold text-slate-900 border-r last:border-r-0 border-slate-200 whitespace-nowrap ${
                  col.align === 'center'
                    ? 'text-center'
                    : col.align === 'right'
                    ? 'text-right'
                    : 'text-left'
                }`}
              >
                <div>{col.header}</div>
                {col.khmerSubHeader && (
                  <div className="text-[11px] font-normal text-slate-600 font-khmer-body">
                    {col.khmerSubHeader}
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 font-khmer-body bg-white">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-10 text-center text-slate-600">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr key={rowKey(row, idx)} className="hover:bg-slate-50/90 transition-colors">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`py-2.5 px-3.5 border-r last:border-r-0 border-slate-100 whitespace-nowrap text-slate-900 tabular-nums ${
                      col.align === 'center'
                        ? 'text-center'
                        : col.align === 'right'
                        ? 'text-right'
                        : 'text-left'
                    }`}
                  >
                    {col.render ? col.render(row, idx) : String(row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// 8. Modal
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidthClass = 'max-w-xl',
}) => {
  if (!isOpen) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
    >
      <div className={`bg-white border border-slate-200 rounded-xl shadow-lg w-full ${maxWidthClass} overflow-hidden max-h-[90vh] flex flex-col`}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 font-khmer-body">{title}</h3>
            {subtitle && <p className="text-xs text-slate-600 font-khmer-body mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            aria-label="Close modal"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// 9. ConfirmationDialog
export interface ConfirmationDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onCancel,
  onConfirm,
  title,
  message,
  confirmLabel = 'យល់ព្រម (Confirm)',
  cancelLabel = 'បោះបង់ (Cancel)',
  tone = 'danger',
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      maxWidthClass="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-xs text-slate-600 font-khmer-body leading-relaxed">{message}</p>
    </Modal>
  );
};

// 10. Tabs
export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ items, activeId, onChange, className = '' }) => {
  return (
    <div className={`flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg ${className}`}>
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer font-khmer-body ${
              isActive
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span className="font-mono-tabular text-[11px] opacity-75">({item.count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

// 11. Pagination
export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}) => {
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(totalItems, currentPage * pageSize);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs">
      <div className="text-slate-600 font-khmer-body tabular-nums">
        បង្ហាញ <strong className="text-slate-900">{start}–{end}</strong> នៃទិន្នន័យសរុប{' '}
        <strong className="text-slate-900">{totalItems}</strong>
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
        >
          មុន (Prev)
        </Button>
        <span className="px-2.5 py-1 text-xs font-mono-tabular text-slate-700">
          Page {currentPage} / {Math.max(1, totalPages)}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
        >
          បន្ទាប់ (Next)
        </Button>
      </div>
    </div>
  );
};

// 12. Toast
export interface ToastProps {
  tone?: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  description?: string;
  onDismiss?: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  tone = 'success',
  title,
  description,
  onDismiss,
}) => {
  const styles = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    danger: 'bg-rose-50 border-rose-200 text-rose-900',
    info: 'bg-indigo-50 border-indigo-200 text-indigo-900',
  }[tone];

  const Icon = {
    success: CheckCircle2,
    warning: AlertTriangle,
    danger: XCircle,
    info: Info,
  }[tone];

  return (
    <div className={`px-4 py-3 border rounded-xl flex items-start justify-between gap-3 ${styles}`}>
      <div className="flex items-start gap-2.5">
        <Icon className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="text-xs font-khmer-body">
          <div className="font-bold">{title}</div>
          {description && <div className="mt-0.5 opacity-90">{description}</div>}
        </div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-semibold hover:underline shrink-0 cursor-pointer"
        >
          បិទ
        </button>
      )}
    </div>
  );
};

// 13. LoadingState
export interface LoadingStateProps {
  label?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  label = 'កំពុងទាញយកទិន្នន័យពីប្រព័ន្ធ... (Loading data...)',
}) => {
  return (
    <div className="py-12 px-4 flex flex-col items-center justify-center text-center gap-3">
      <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
      <p className="text-xs font-medium text-slate-600 font-khmer-body">{label}</p>
    </div>
  );
};

// 14. EmptyState
export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, action }) => {
  return (
    <div className="py-12 px-4 flex flex-col items-center justify-center text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
      <Inbox className="w-8 h-8 text-slate-400 mb-2" />
      <h4 className="text-sm font-bold text-slate-900 font-khmer-body">{title}</h4>
      {description && (
        <p className="text-xs text-slate-600 font-khmer-body mt-1 max-w-md">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};
