import { CardGridView } from '../components/CardGridView';

export function FutureStock() {
  return (
    <CardGridView
      title="Future Stock"
      status="SOURCED"
      showAging
      emptyMessage="Sourced bags waiting to ship will appear here. Tap + to add one."
    />
  );
}
