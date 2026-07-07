import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Empty, Space } from "antd";

type PlainListProps<T> = {
  className?: string;
  dataSource?: T[];
  header?: ReactNode;
  locale?: {
    emptyText?: ReactNode;
  };
  renderItem: (item: T, index: number) => ReactNode;
  size?: "small" | "default" | "large";
  style?: CSSProperties;
};

type PlainListItemProps = {
  actions?: ReactNode[];
  children: ReactNode;
};

type PlainListMetaProps = {
  description?: ReactNode;
  title?: ReactNode;
};

type PlainListItemComponent = ((props: PlainListItemProps) => ReactElement) & {
  Meta: (props: PlainListMetaProps) => ReactElement;
};

type PlainListComponent = (<T>(props: PlainListProps<T>) => ReactElement) & {
  Item: PlainListItemComponent;
};

function PlainListBase<T>({
  className,
  dataSource = [],
  header,
  locale,
  renderItem,
  size = "default",
  style
}: PlainListProps<T>): ReactElement {
  const classes = ["plain-list", size !== "default" ? `plain-list-${size}` : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} style={style}>
      {header && <div className="plain-list-header">{header}</div>}
      {dataSource.length === 0 ? (
        <div className="plain-list-empty">
          {locale?.emptyText ?? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />}
        </div>
      ) : (
        <div className="plain-list-body">
          {dataSource.map((item, index) => (
            <div className="plain-list-row" key={index}>
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlainListMeta({ description, title }: PlainListMetaProps): ReactElement {
  return (
    <div className="plain-list-meta">
      {title && <div className="plain-list-meta-title">{title}</div>}
      {description && <div className="plain-list-meta-description">{description}</div>}
    </div>
  );
}

const PlainListItemBase = (({ actions, children }: PlainListItemProps): ReactElement => {
  return (
    <div className="plain-list-item">
      <div className="plain-list-item-content">{children}</div>
      {actions && actions.length > 0 && (
        <Space className="plain-list-actions" wrap>
          {actions}
        </Space>
      )}
    </div>
  );
}) as PlainListItemComponent;

PlainListItemBase.Meta = PlainListMeta;

export const PlainList = PlainListBase as PlainListComponent;
PlainList.Item = PlainListItemBase;
