import { INFO_STATUS } from 'constants';
import {
  LOAD_ENCOUNTERS_INFO,
  SET_ENCOUNTERS_INFO,
  SET_ENCOUNTERS_VESSEL_INFO,
  CLEAR_ENCOUNTERS_INFO
} from 'mapPanels/rightControlPanel/actions/encounters';


const initialState = {
  encountersInfo: null,
  infoPanelStatus: INFO_STATUS.HIDDEN
};

export default function (state = initialState, action) {
  switch (action.type) {
    case LOAD_ENCOUNTERS_INFO: {
      return Object.assign({}, state, {
        infoPanelStatus: INFO_STATUS.LOADING
      });
    }

    case SET_ENCOUNTERS_INFO: {
      return Object.assign({}, state, {
        infoPanelStatus: INFO_STATUS.LOADED,
        encountersInfo: action.payload.encounterInfo
      });
    }

    case SET_ENCOUNTERS_VESSEL_INFO: {
      const newEncountersInfo = Object.assign({}, state.encountersInfo);
      const newVesselIndex = state.encountersInfo.vessels.findIndex(vessel => vessel.seriesgroup === action.payload.seriesgroup);
      const newVessel = Object.assign({}, newEncountersInfo.vessels[newVesselIndex]);
      newVessel.info = action.payload.info;
      newEncountersInfo.vessels[newVesselIndex] = newVessel;
      return Object.assign({}, state, {
        encountersInfo: newEncountersInfo
      });
    }

    case CLEAR_ENCOUNTERS_INFO: {
      return Object.assign({}, state, {
        infoPanelStatus: INFO_STATUS.HIDDEN,
        encountersInfo: null
      });
    }

    default:
      return state;
  }
}
