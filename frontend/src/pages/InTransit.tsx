import { CardGridView } from '../components/CardGridView';

export function InTransit() {
  return (
    <CardGridView
      title="In Transit"
      status="IN_TRANSIT"
      showAging
      emptyMessage="Bags on their way to you will appear here."
    />
  );
}
