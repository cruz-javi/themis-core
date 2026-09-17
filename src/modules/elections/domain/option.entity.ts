export class Option {
  constructor(
    public readonly id: string,
    public readonly electionId: string,
    public readonly nombre: string,
    public readonly descripcion: string | null,
    public readonly createdAt: Date,
  ) {}
}
