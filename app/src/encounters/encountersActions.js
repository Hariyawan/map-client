import fetchEndpoint from 'util/fetchEndpoint';
import { getTrack, deleteTracks } from 'tracks/tracksActions';
import { highlightClickedVessel, clearHighlightClickedVessel } from 'actions/heatmap';
import { VESSEL_TYPE_REEFER, LAYER_TYPES } from 'constants';
import { ENCOUNTERS_VESSEL_COLOR, ENCOUNTERS_REEFER_COLOR } from 'config';
import buildEndpoint from 'util/buildEndpoint';

export const LOAD_ENCOUNTERS_INFO = 'LOAD_ENCOUNTERS_INFO';
export const SET_ENCOUNTERS_INFO = 'SET_ENCOUNTERS_INFO';
export const SET_ENCOUNTERS_VESSEL_INFO = 'SET_ENCOUNTERS_VESSEL_INFO';
export const CLEAR_ENCOUNTERS_INFO = 'CLEAR_ENCOUNTERS_INFO';
export const HIDE_ENCOUNTERS_INFO_PANEL = 'HIDE_ENCOUNTERS_INFO_PANEL';

export function hideEncountersInfoPanel() {
  return {
    type: HIDE_ENCOUNTERS_INFO_PANEL
  };
}

export function clearEncountersInfo() {
  return (dispatch, getState) => {
    const currentEncountersInfo = getState().encounters.encountersInfo;
    dispatch({
      type: CLEAR_ENCOUNTERS_INFO
    });
    dispatch(clearHighlightClickedVessel());
    if (currentEncountersInfo !== null) {
      const seriesgroupArray = currentEncountersInfo.vessels.map(v => v.seriesgroup);
      dispatch(deleteTracks(seriesgroupArray));
    }
  };
}

export function setEncountersInfo(seriesgroup, tilesetId) {
  return (dispatch, getState) => {
    const layer = getState().layers.workspaceLayers.find(l => l.tilesetId === tilesetId);
    if (layer.header.endpoints === undefined || layer.header.endpoints.info === undefined) {
      console.warn('Info field is missing on header\'s urls, can\'t display encounters details');
      return;
    }
    const encounterInfoEndpoint = layer.header.endpoints.info;

    dispatch(highlightClickedVessel(seriesgroup, null, LAYER_TYPES.Encounters, layer.id));

    dispatch({
      type: LOAD_ENCOUNTERS_INFO,
      payload: {
        seriesgroup,
        tilesetId
      }
    });


    const infoUrl = buildEndpoint(encounterInfoEndpoint, {
      id: seriesgroup
    });
    const token = getState().user.token;

    fetchEndpoint(infoUrl, token).then((encounterInfo) => {
      encounterInfo.vessels = [{
        tilesetId: encounterInfo.vessel_1_tileset,
        seriesgroup: encounterInfo.vessel_1_id,
        vesselTypeName: encounterInfo.vessel_1_type
      }, {
        tilesetId: encounterInfo.vessel_2_tileset,
        seriesgroup: encounterInfo.vessel_2_id,
        vesselTypeName: encounterInfo.vessel_2_type
      }];

      dispatch({
        type: SET_ENCOUNTERS_INFO,
        payload: {
          encounterInfo
        }
      });

      const workspaceLayers = getState().layers.workspaceLayers;

      encounterInfo.vessels.forEach((vessel) => {
        const vesselWorkspaceLayer = workspaceLayers.find(workspaceLayer =>
          workspaceLayer.tilesetId === vessel.tilesetId || workspaceLayer.id === vessel.tilesetId);
        const fields = vesselWorkspaceLayer.header.info.fields;

        fetchEndpoint(buildEndpoint(vesselWorkspaceLayer.header.endpoints.info, { id: vessel.seriesgroup }), token)
          .then((vesselInfo) => {
            dispatch({
              type: SET_ENCOUNTERS_VESSEL_INFO,
              payload: {
                seriesgroup: vessel.seriesgroup,
                vesselInfo,
                fields
              }
            });
          });

        dispatch(getTrack({
          tilesetId: vesselWorkspaceLayer.tilesetId,
          seriesgroup: vessel.seriesgroup,
          series: null,
          zoomToBounds: false,
          updateTimelineBounds: false,
          color: (vessel.vesselTypeName === VESSEL_TYPE_REEFER) ? ENCOUNTERS_REEFER_COLOR : ENCOUNTERS_VESSEL_COLOR
        }));
      });
    });
  };
}
