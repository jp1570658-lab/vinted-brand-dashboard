import { CardGridView } from '../components/CardGridView';

export function InStock() {
  return (
    <CardGridView
      title="In Stock"
      status="IN_STOCK"
      showListed
      emptyMessage="Bags ready to list and sell will appear here."
    />
  );
}
