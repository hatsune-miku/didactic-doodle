export interface EntryRequest {
  title: string
  label: string
  placeholder?: string
  onSubmit: (value: string) => void
}
