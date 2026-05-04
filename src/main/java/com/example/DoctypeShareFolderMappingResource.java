package com.example;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;

@Path("/doctype-share-folder-mappings")
@Produces(MediaType.APPLICATION_JSON)
public class DoctypeShareFolderMappingResource {
    @GET
    @Path("/unsafe")
    public DoctypeShareFolderMapping findUnsafe(@QueryParam("doctype") String doctype) {
        return DoctypeShareFolderMapping.findByDoctypeUnsafe(doctype);
    }

    @GET
    @Path("/safe")
    public DoctypeShareFolderMapping findSafe(@QueryParam("doctype") String doctype) {
        return DoctypeShareFolderMapping.findByDoctypeSafe(doctype);
    }
}