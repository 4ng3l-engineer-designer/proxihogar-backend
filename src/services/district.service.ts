// src/services/district.service.ts
import { DISTRICTS_DATA, DistrictsResponse } from "../data/districts";

export class DistrictService {
  getDistricts(): DistrictsResponse {
    return DISTRICTS_DATA;
  }
}
