import { Empty, Typography } from "antd";

type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <Empty className="pas-empty-state" description={title}>
      <Typography.Text className="pas-empty-state-description" type="secondary">
        {description}
      </Typography.Text>
    </Empty>
  );
}
