import { UrdCreated as UrdCreatedEvent } from "../generated/URDFactory/URDFactory"
import {URD} from "../generated/templates";

export function handleUrdCreated(event: UrdCreatedEvent): void {
  URD.create(event.params.urd);
}
