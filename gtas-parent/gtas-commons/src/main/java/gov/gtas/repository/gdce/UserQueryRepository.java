package gov.gtas.repository.gdce;

import org.springframework.data.repository.CrudRepository;

import gov.gtas.querybuilder.model.UserQuery;

public interface UserQueryRepository extends CrudRepository<UserQuery, Integer>{
	
}
