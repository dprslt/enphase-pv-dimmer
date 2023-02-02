export abstract class TestAdapter {
    iteration: number = 0;

    public nextIteration(): void {
        this.iteration++;
        this.makeIteration();
    }

    abstract makeIteration(): void;
}
